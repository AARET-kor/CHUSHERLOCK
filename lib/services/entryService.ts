import { randomUUID } from "node:crypto";
import { eq, and, inArray, desc } from "drizzle-orm";
import { db, sqliteClient } from "../db/client";
import {
  entries,
  sources,
  entrySources,
  entryRelations,
  entryClaims,
  figures,
} from "../db/schema";
import type { CodexEntry, EntryClaim, SourceRef } from "../codex/types";
import { getCategory } from "../codex/taxonomy";
import { findOverlapCandidates, type OverlapCandidate } from "../codex/overlap";
import { findSemanticRelatedIds } from "../ai/relatedness";
import type { CreateEntryInput, UpdateEntryInput } from "../schemas/entrySchemas";

export interface EntryFilter {
  categoryKey?: string;
  tier?: string;
  status?: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function batches<T>(values: T[], size = 500): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < values.length; i += size) result.push(values.slice(i, i + size));
  return result;
}

/**
 * Hydrate an arbitrary entry list in bounded bulk queries. The old
 * implementation issued two extra queries per note (N+1); this remains a
 * constant two queries for normal libraries and scales in 500-id batches.
 */
async function hydrateEntries(rows: Array<typeof entries.$inferSelect>): Promise<CodexEntry[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);
  const entrySourceRows: Array<{ entryId: string; source: typeof sources.$inferSelect }> = [];
  const relationRows: Array<{ entryId: string; relatedEntryId: string }> = [];
  const claimRows: Array<typeof entryClaims.$inferSelect> = [];

  for (const idBatch of batches(ids)) {
    entrySourceRows.push(
      ...(await db
        .select({ entryId: entrySources.entryId, source: sources })
        .from(entrySources)
        .innerJoin(sources, eq(entrySources.sourceId, sources.id))
        .where(inArray(entrySources.entryId, idBatch)))
    );
    relationRows.push(
      ...(await db
        .select({
          entryId: entryRelations.entryId,
          relatedEntryId: entryRelations.relatedEntryId,
        })
        .from(entryRelations)
        .where(inArray(entryRelations.entryId, idBatch)))
    );
    claimRows.push(
      ...(await db
        .select()
        .from(entryClaims)
        .where(inArray(entryClaims.entryId, idBatch)))
    );
  }

  const sourcesByEntry = new Map<string, SourceRef[]>();
  for (const { entryId, source } of entrySourceRows) {
    const hydrated: SourceRef = {
      id: source.id,
      type: source.type as SourceRef["type"],
      citation: source.citation,
      url: source.url ?? undefined,
      authors: source.authors ?? undefined,
      year: source.year ?? undefined,
      versionLabel: source.versionLabel ?? undefined,
      validUntil: source.validUntil ?? undefined,
      evidenceLevel: source.evidenceLevel
        ? (source.evidenceLevel as SourceRef["evidenceLevel"])
        : undefined,
    };
    const current = sourcesByEntry.get(entryId) ?? [];
    current.push(hydrated);
    sourcesByEntry.set(entryId, current);
  }

  const relationsByEntry = new Map<string, string[]>();
  for (const { entryId, relatedEntryId } of relationRows) {
    const current = relationsByEntry.get(entryId) ?? [];
    current.push(relatedEntryId);
    relationsByEntry.set(entryId, current);
  }

  const claimsByEntry = new Map<string, EntryClaim[]>();
  for (const claim of claimRows) {
    const hydrated: EntryClaim = {
      id: claim.id,
      sourceId: claim.sourceId ?? undefined,
      claimText: claim.claimText,
      representation: claim.representation as EntryClaim["representation"],
      originalQuote: claim.originalQuote ?? undefined,
      sourceLocation: claim.sourceLocation,
      pageStart: claim.pageStart ?? undefined,
      pageEnd: claim.pageEnd ?? undefined,
      section: claim.section ?? undefined,
      evidenceLevel: claim.evidenceLevel as EntryClaim["evidenceLevel"],
      conflictStatus: claim.conflictStatus as EntryClaim["conflictStatus"],
      conflictNote: claim.conflictNote ?? undefined,
      conflictsWithClaimId: claim.conflictsWithClaimId ?? undefined,
      verifiedBy: claim.verifiedBy ?? undefined,
      verifiedAt: claim.verifiedAt ?? undefined,
      generatedByModel: claim.generatedByModel ?? undefined,
      promptVersion: claim.promptVersion ?? undefined,
    };
    const current = claimsByEntry.get(claim.entryId) ?? [];
    current.push(hydrated);
    claimsByEntry.set(claim.entryId, current);
  }

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    content: row.content,
    categoryKey: row.categoryKey,
    tier: row.tier as CodexEntry["tier"],
    tags: row.tags,
    status: row.status as CodexEntry["status"],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    contentVersion: row.contentVersion,
    reviewedBy: row.reviewedBy ?? undefined,
    reviewedAt: row.reviewedAt ?? undefined,
    reviewDueAt: row.reviewDueAt ?? undefined,
    sources: sourcesByEntry.get(row.id) ?? [],
    relatedEntryIds: relationsByEntry.get(row.id) ?? [],
    claims: claimsByEntry.get(row.id) ?? [],
  }));
}

export async function listEntries(filter: EntryFilter = {}): Promise<CodexEntry[]> {
  const conditions = [];
  if (filter.categoryKey) conditions.push(eq(entries.categoryKey, filter.categoryKey));
  if (filter.tier) conditions.push(eq(entries.tier, filter.tier));
  if (filter.status) conditions.push(eq(entries.status, filter.status));

  const rows = conditions.length
    ? await db.select().from(entries).where(and(...conditions))
    : await db.select().from(entries);

  return hydrateEntries(rows);
}

export async function getEntry(id: string): Promise<CodexEntry | null> {
  const [row] = await db.select().from(entries).where(eq(entries.id, id));
  if (!row) return null;
  return (await hydrateEntries([row]))[0] ?? null;
}

/** Overlap candidates for a prospective title/category, before the entry is
 * saved — used by the UI to warn "this looks like an existing note". */
export async function previewOverlaps(
  title: string,
  categoryKey: string
): Promise<Array<OverlapCandidate & { similarity: number }>> {
  const existing = await db
    .select({ id: entries.id, title: entries.title, categoryKey: entries.categoryKey })
    .from(entries);
  return findOverlapCandidates(title, categoryKey, existing);
}

export interface CreateEntryResult {
  entry: CodexEntry;
  overlaps: Array<OverlapCandidate & { similarity: number }>;
}

/** Same-category entries offered to the semantic relatedness check,
 * newest first, capped so the prompt stays small (token budget). */
const SEMANTIC_CANDIDATE_LIMIT = 24;
/** Chars of each candidate note shown to the relatedness screen. */
const SEMANTIC_EXCERPT_CHARS = 240;

async function semanticRelatedIds(input: CreateEntryInput): Promise<string[]> {
  const candidateRows = await db
    .select({ id: entries.id, title: entries.title, content: entries.content })
    .from(entries)
    .where(eq(entries.categoryKey, input.categoryKey))
    .orderBy(desc(entries.updatedAt))
    .limit(SEMANTIC_CANDIDATE_LIMIT);

  if (candidateRows.length === 0) return [];

  const category = getCategory(input.categoryKey);
  return findSemanticRelatedIds({
    newNote: {
      title: input.title,
      content: input.content,
      categoryLabel: `${category.labelKo} / ${category.labelEn}`,
    },
    candidates: candidateRows.map((row) => ({
      id: row.id,
      title: row.title,
      excerpt: row.content.slice(0, SEMANTIC_EXCERPT_CHARS),
    })),
  });
}

/** Creates an entry and auto-links it to related existing entries: a fast
 * title-similarity pass (lib/codex/overlap.ts) plus a semantic pass where
 * the model judges same-category notes for genuine topic overlap
 * (lib/ai/relatedness.ts — never throws, degrades to the heuristic). */
export interface PreparedFigure {
  id: string;
  filename: string;
  kind: string;
  caption: string;
  page: number | null;
  createdAt: string;
}

/**
 * All relational writes for one note are committed together. `preparedFigures`
 * is used by .cognote import after its files have been staged on disk; a DB
 * failure leaves no partial entry/source/relation/figure rows.
 */
export async function createEntry(
  input: CreateEntryInput,
  options: { preparedFigures?: PreparedFigure[] } = {}
): Promise<CreateEntryResult> {
  const overlaps = await previewOverlaps(input.title, input.categoryKey);
  const semanticIds = await semanticRelatedIds(input);
  const relatedEntryIds = Array.from(
    new Set([...input.relatedEntryIds, ...overlaps.map((o) => o.id), ...semanticIds])
  );

  const id = randomUUID();
  const timestamp = nowIso();
  const transaction = sqliteClient.transaction(() => {
    const sourceIds = input.sources.map((source) => {
      const existing = sqliteClient
        .prepare("SELECT id FROM sources WHERE citation = ? LIMIT 1")
        .get(source.citation) as { id: string } | undefined;
      const sourceId = existing?.id ?? randomUUID();
      if (!existing) {
        sqliteClient
          .prepare(
            `INSERT INTO sources (id, type, citation, url, authors, year)
             VALUES (?, ?, ?, ?, ?, ?)`
          )
          .run(
            sourceId,
            source.type,
            source.citation,
            source.url || null,
            source.authors || null,
            source.year ?? null
          );
      }
      sqliteClient
        .prepare(
          `UPDATE sources
              SET version_label = COALESCE(?, version_label),
                  valid_until = COALESCE(?, valid_until),
                  evidence_level = COALESCE(?, evidence_level)
            WHERE id = ?`
        )
        .run(
          source.versionLabel || null,
          source.validUntil || null,
          source.evidenceLevel || null,
          sourceId
        );
      return sourceId;
    });

    sqliteClient
      .prepare(
        `INSERT INTO entries
          (id, title, content, category_key, tier, tags, status, created_at, updated_at,
           content_version, reviewed_by, reviewed_at, review_due_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`
      )
      .run(
        id,
        input.title,
        input.content,
        input.categoryKey,
        input.tier,
        JSON.stringify(input.tags),
        input.status,
        timestamp,
        timestamp,
        input.status === "reviewed" ? input.reviewedBy || "사용자" : null,
        input.status === "reviewed" ? timestamp : null,
        input.reviewDueAt || null
      );

    const insertEntrySource = sqliteClient.prepare(
      "INSERT OR IGNORE INTO entry_sources (entry_id, source_id) VALUES (?, ?)"
    );
    for (const sourceId of sourceIds) insertEntrySource.run(id, sourceId);

    const insertClaim = sqliteClient.prepare(
      `INSERT INTO entry_claims
        (id, entry_id, source_id, claim_text, representation, original_quote,
         source_location, page_start, page_end, section, evidence_level,
         conflict_status, conflict_note, conflicts_with_claim_id, verified_by,
         verified_at, generated_by_model, prompt_version, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const claim of input.claims) {
      insertClaim.run(
        randomUUID(),
        id,
        sourceIds[claim.sourceIndex] ?? sourceIds[0] ?? null,
        claim.claimText,
        claim.representation,
        claim.originalQuote || null,
        claim.sourceLocation,
        claim.pageStart ?? null,
        claim.pageEnd ?? claim.pageStart ?? null,
        claim.section || null,
        claim.evidenceLevel,
        claim.conflictStatus,
        claim.conflictNote || null,
        claim.conflictsWithClaimId || null,
        claim.verifiedBy || null,
        claim.verifiedAt || null,
        input.provenance?.model || null,
        input.provenance?.promptVersion || null,
        timestamp
      );
    }

    const insertRelation = sqliteClient.prepare(
      "INSERT OR IGNORE INTO entry_relations (entry_id, related_entry_id) VALUES (?, ?)"
    );
    for (const relatedId of relatedEntryIds) {
      if (relatedId === id) continue;
      const exists = sqliteClient
        .prepare("SELECT 1 FROM entries WHERE id = ?")
        .get(relatedId);
      if (!exists) continue;
      insertRelation.run(id, relatedId);
      insertRelation.run(relatedId, id);
    }

    const insertFigure = sqliteClient.prepare(
      `INSERT INTO figures
        (id, job_id, entry_id, filename, kind, caption, page, created_at)
       VALUES (?, NULL, ?, ?, ?, ?, ?, ?)`
    );
    for (const figure of options.preparedFigures ?? []) {
      insertFigure.run(
        figure.id,
        id,
        figure.filename,
        figure.kind,
        figure.caption,
        figure.page,
        figure.createdAt
      );
    }

    if (input.figureIds.length > 0) {
      const attachFigure = sqliteClient.prepare(
        "UPDATE figures SET entry_id = ? WHERE id = ?"
      );
      for (const figureId of input.figureIds) attachFigure.run(id, figureId);
    }
  });
  transaction.immediate();

  const entry = await getEntry(id);
  if (!entry) throw new Error("Failed to load entry immediately after creation.");
  return { entry, overlaps };
}

export async function updateEntry(input: UpdateEntryInput): Promise<CodexEntry> {
  const existing = await getEntry(input.id);
  if (!existing) throw new Error(`Entry not found: ${input.id}`);
  const timestamp = nowIso();
  const nextStatus = input.status ?? existing.status;
  const reviewedAt =
    nextStatus === "reviewed"
      ? existing.reviewedAt ?? timestamp
      : null;
  const reviewedBy =
    nextStatus === "reviewed"
      ? input.reviewedBy || existing.reviewedBy || input.changedBy || "사용자"
      : null;

  sqliteClient
    .transaction(() => {
      sqliteClient
        .prepare(
          `INSERT INTO entry_revisions
            (id, entry_id, version, title, content, status, changed_by, change_note, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          randomUUID(),
          existing.id,
          existing.contentVersion,
          existing.title,
          existing.content,
          existing.status,
          input.changedBy || reviewedBy,
          input.changeNote || null,
          timestamp
        );
      sqliteClient
        .prepare(
          `UPDATE entries
              SET title = ?, content = ?, category_key = ?, tier = ?, tags = ?,
                  status = ?, updated_at = ?, content_version = content_version + 1,
                  reviewed_by = ?, reviewed_at = ?, review_due_at = ?
            WHERE id = ?`
        )
        .run(
          input.title ?? existing.title,
          input.content ?? existing.content,
          input.categoryKey ?? existing.categoryKey,
          input.tier ?? existing.tier,
          JSON.stringify(input.tags ?? existing.tags),
          nextStatus,
          timestamp,
          reviewedBy,
          reviewedAt,
          input.reviewDueAt === "" ? null : input.reviewDueAt ?? existing.reviewDueAt ?? null,
          input.id
        );
    })
    .immediate();

  const updated = await getEntry(input.id);
  if (!updated) throw new Error(`Entry disappeared during update: ${input.id}`);
  return updated;
}

export async function deleteEntry(id: string): Promise<void> {
  await db.delete(entries).where(eq(entries.id, id));
}

export interface MergeEntriesInput {
  /** 2+ entry ids, in the order their content should appear. */
  entryIds: string[];
  title: string;
  categoryKey: string;
  tier: string;
  status?: string;
}

/**
 * Merges several notes into one: contents are stitched in order under their
 * old titles, sources/tags/relations/figures are unioned and re-pointed, and
 * the source notes are deleted. No AI calls — this is a deliberate, manual
 * curation action.
 */
export async function mergeEntries(input: MergeEntriesInput): Promise<CodexEntry> {
  const parts = await Promise.all(input.entryIds.map(getEntry));
  const merged = parts.filter((e): e is CodexEntry => Boolean(e));
  if (merged.length < 2) throw new Error("합칠 노트를 2개 이상 선택해 주세요.");

  const id = randomUUID();
  const timestamp = nowIso();

  const content = merged
    .map((entry) => `## ${entry.title}\n\n${entry.content.trim()}`)
    .join("\n\n---\n\n");
  const tags = Array.from(new Set(merged.flatMap((e) => e.tags)));
  const sourceIds = Array.from(new Set(merged.flatMap((e) => e.sources.map((s) => s.id))));
  const mergedIdSet = new Set(input.entryIds);
  const relatedIds = Array.from(
    new Set(merged.flatMap((e) => e.relatedEntryIds).filter((rid) => !mergedIdSet.has(rid)))
  );

  sqliteClient
    .transaction(() => {
      sqliteClient
        .prepare(
          `INSERT INTO entries
            (id, title, content, category_key, tier, tags, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          id,
          input.title,
          content,
          input.categoryKey,
          input.tier,
          JSON.stringify(tags),
          input.status ?? "draft",
          timestamp,
          timestamp
        );

      const insertSource = sqliteClient.prepare(
        "INSERT OR IGNORE INTO entry_sources (entry_id, source_id) VALUES (?, ?)"
      );
      for (const sourceId of sourceIds) insertSource.run(id, sourceId);

      const insertRelation = sqliteClient.prepare(
        "INSERT OR IGNORE INTO entry_relations (entry_id, related_entry_id) VALUES (?, ?)"
      );
      for (const relatedId of relatedIds) {
        insertRelation.run(id, relatedId);
        insertRelation.run(relatedId, id);
      }

      const placeholders = input.entryIds.map(() => "?").join(",");
      sqliteClient
        .prepare(`UPDATE figures SET entry_id = ? WHERE entry_id IN (${placeholders})`)
        .run(id, ...input.entryIds);
      sqliteClient
        .prepare(`DELETE FROM entries WHERE id IN (${placeholders})`)
        .run(...input.entryIds);
    })
    .immediate();

  const entry = await getEntry(id);
  if (!entry) throw new Error("Failed to load merged entry.");
  return entry;
}

/** Bind cropped source figures to the entry that now uses them. */
export async function attachFiguresToEntry(entryId: string, figureIds: string[]): Promise<void> {
  if (figureIds.length === 0) return;
  await db.update(figures).set({ entryId }).where(inArray(figures.id, figureIds));
}

/** id → filename for the figures attached to the given entries (used by the
 * Obsidian export to bundle image files and rewrite links). */
export async function figureFilesForEntries(entryIds: string[]): Promise<Map<string, string>> {
  if (entryIds.length === 0) return new Map();
  const rows = await db
    .select({ id: figures.id, filename: figures.filename })
    .from(figures)
    .where(inArray(figures.entryId, entryIds));
  return new Map(rows.map((r) => [r.id, r.filename]));
}

export async function markExported(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await db
    .update(entries)
    .set({ exportedAt: nowIso() })
    .where(inArray(entries.id, ids));
}
