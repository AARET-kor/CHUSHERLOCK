import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let temporaryDir = "";
let categoryKey = "";
let sqlite: import("better-sqlite3").Database;
let entryService: typeof import("../lib/services/entryService");
let ingestService: typeof import("../lib/services/ingestService");
let createEntrySchema: typeof import("../lib/schemas/entrySchemas").createEntrySchema;

function entryInput(
  overrides: Record<string, unknown> = {}
): ReturnType<typeof createEntrySchema.parse> {
  return createEntrySchema.parse({
    title: "통합 테스트 노트",
    content: "임상적으로 의미 있는 통합 테스트 내용입니다. 수치 10 mg을 기록합니다.",
    categoryKey,
    tier: "deep_study",
    tags: ["integration"],
    sources: [{ type: "paper", citation: `통합 출처 ${crypto.randomUUID()}` }],
    relatedEntryIds: [],
    figureIds: [],
    claims: [],
    status: "draft",
    ...overrides,
  });
}

async function waitForJob(id: string, expected: string, timeoutMs = 5_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const job = await ingestService.getIngestJob(id);
    if (job?.status === expected) return job;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`job ${id} did not reach ${expected}`);
}

beforeAll(async () => {
  temporaryDir = fs.mkdtempSync(path.join(os.tmpdir(), "cognitio-integration-"));
  process.env.CODEX_DB_PATH = path.join(temporaryDir, "test.sqlite");
  process.env.CODEX_FIGURES_DIR = path.join(temporaryDir, "figures");
  process.env.CODEX_INGEST_PAYLOAD_DIR = path.join(temporaryDir, "ingest");
  process.env.CODEX_AI_MODE = "fake";
  process.env.CODEX_INGEST_LEASE_MS = "1000";

  const [{ db, sqliteClient }, { migrate }, schema, taxonomy, schemas, entries, ingest] =
    await Promise.all([
      import("../lib/db/client"),
      import("drizzle-orm/better-sqlite3/migrator"),
      import("../lib/db/schema"),
      import("../lib/codex/taxonomy"),
      import("../lib/schemas/entrySchemas"),
      import("../lib/services/entryService"),
      import("../lib/services/ingestService"),
    ]);
  migrate(db, { migrationsFolder: path.resolve("drizzle") });
  const insertCategory = sqliteClient.prepare(
    `INSERT OR IGNORE INTO categories
      (key, label_ko, label_en, parent_key, description_ko, description_en)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  for (const category of taxonomy.CATEGORY_TAXONOMY) {
    insertCategory.run(
      category.key,
      category.labelKo,
      category.labelEn,
      category.parentKey ?? null,
      category.descriptionKo ?? null,
      category.descriptionEn ?? null
    );
  }
  categoryKey = taxonomy.getLeafCategories()[0]!.key;
  sqlite = sqliteClient;
  entryService = entries;
  ingestService = ingest;
  createEntrySchema = schemas.createEntrySchema;
});

afterAll(() => {
  sqlite.close();
  fs.rmSync(temporaryDir, { recursive: true, force: true });
});

describe("database transactions and provenance", () => {
  it("rolls back a source when entry creation fails", async () => {
    const before = (sqlite.prepare("SELECT COUNT(*) count FROM sources").get() as { count: number })
      .count;
    await expect(
      entryService.createEntry(entryInput({ categoryKey: "missing-category" }))
    ).rejects.toThrow();
    const after = (sqlite.prepare("SELECT COUNT(*) count FROM sources").get() as { count: number })
      .count;
    expect(after).toBe(before);
  });

  it("stores claim provenance and writes an immutable revision on edit", async () => {
    const input = entryInput({
      sources: [
        {
          type: "manufacturer_guideline",
          citation: "근거 추적 가이드 v2",
          versionLabel: "v2",
          validUntil: "2027-12-31",
          evidenceLevel: "guideline",
        },
      ],
      claims: [
        {
          claimText: "권장 용량은 10 mg이다.",
          representation: "ai_paraphrase",
          originalQuote: "recommended dose was 10 mg",
          sourceLocation: "Section 2",
          pageStart: 12,
          pageEnd: 12,
          section: "Dose",
          sourceIndex: 0,
          evidenceLevel: "guideline",
          conflictStatus: "none",
        },
      ],
      provenance: { model: "test-model", promptVersion: "test-v1" },
    });
    const created = await entryService.createEntry(input);
    expect(created.entry.claims[0]).toMatchObject({
      pageStart: 12,
      representation: "ai_paraphrase",
      generatedByModel: "test-model",
    });
    expect(created.entry.sources[0]).toMatchObject({
      versionLabel: "v2",
      evidenceLevel: "guideline",
    });

    const updated = await entryService.updateEntry({
      id: created.entry.id,
      title: "검토 완료된 노트",
      status: "reviewed",
      reviewedBy: "Dr. Test",
      reviewDueAt: "2027-01-01",
      changedBy: "Dr. Test",
      changeNote: "원문 대조",
    });
    expect(updated.contentVersion).toBe(2);
    expect(updated.reviewedBy).toBe("Dr. Test");
    const revision = sqlite
      .prepare("SELECT version, change_note FROM entry_revisions WHERE entry_id = ?")
      .get(created.entry.id) as { version: number; change_note: string };
    expect(revision).toEqual({ version: 1, change_note: "원문 대조" });
  });

  it("keeps source notes when a merge transaction fails", async () => {
    const first = await entryService.createEntry(entryInput({ title: "합치기 A" }));
    const second = await entryService.createEntry(entryInput({ title: "합치기 B" }));
    await expect(
      entryService.mergeEntries({
        entryIds: [first.entry.id, second.entry.id],
        title: "실패해야 하는 merge",
        categoryKey: "missing-category",
        tier: "deep_study",
      })
    ).rejects.toThrow();
    expect(await entryService.getEntry(first.entry.id)).not.toBeNull();
    expect(await entryService.getEntry(second.entry.id)).not.toBeNull();
  });
});

describe("durable ingest recovery", () => {
  it("reclaims an expired lease from its persisted payload", async () => {
    const id = crypto.randomUUID();
    const payloadPath = path.join(temporaryDir, `${id}.text`);
    fs.writeFileSync(payloadPath, "복구 가능한 ingest 원문입니다. 용량은 10 mg입니다.");
    const old = new Date(Date.now() - 60_000).toISOString();
    sqlite
      .prepare(
        `INSERT INTO ingest_jobs
          (id, source_label, source_citation, source_type, status, total_chunks,
           processed_chunks, payload_path, payload_kind, attempts, max_attempts,
           lease_until, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'processing', 0, 0, ?, 'text', 0, 3, ?, ?, ?)`
      )
      .run(id, "복구 텍스트", "복구 출처", "personal_note", payloadPath, old, old, old);

    ingestService.kickIngestWorker();
    const completed = await waitForJob(id, "completed");
    expect(completed.attempts).toBe(1);
    expect(completed.suggestions).toBeTruthy();
    expect(fs.existsSync(payloadPath)).toBe(false);
  });

  it("cancels a queued durable job", async () => {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    sqlite
      .prepare(
        `INSERT INTO ingest_jobs
          (id, source_label, source_citation, source_type, status, total_chunks,
           processed_chunks, attempts, max_attempts, created_at, updated_at)
         VALUES (?, 'queued', 'citation', 'other', 'pending', 0, 0, 0, 3, ?, ?)`
      )
      .run(id, now, now);
    await ingestService.cancelIngestJob(id);
    const cancelled = await waitForJob(id, "cancelled");
    expect(cancelled.cancelRequestedAt).toBeTruthy();
  });
});

describe("API validation", () => {
  it("returns 400 for malformed and invalid entry requests", async () => {
    const route = await import("../app/api/entries/route");
    const malformed = await route.POST(
      new Request("http://localhost/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      })
    );
    expect(malformed.status).toBe(400);

    const invalid = await route.POST(
      new Request("http://localhost/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "x" }),
      })
    );
    expect(invalid.status).toBe(400);
  });
});
