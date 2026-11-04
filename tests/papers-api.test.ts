// tests/papers-api.test.ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setupTempDb } from "./helpers/tempDb";

let env: Awaited<ReturnType<typeof setupTempDb>>;
let s: typeof import("../lib/services/paperService");
let sync: typeof import("../app/api/papers/sync/route");
let review: typeof import("../app/api/papers/[pmid]/route");
let analyze: typeof import("../app/api/papers/[pmid]/analyze/route");
let journals: typeof import("../app/api/papers/journals/route");

beforeAll(async () => {
  env = await setupTempDb("papers-api");
  s = await import("../lib/services/paperService");
  sync = await import("../app/api/papers/sync/route");
  review = await import("../app/api/papers/[pmid]/route");
  analyze = await import("../app/api/papers/[pmid]/analyze/route");
  journals = await import("../app/api/papers/journals/route");
  s.upsertPaper(
    {
      pmid: "900",
      doi: null,
      pmcid: null,
      title: "T",
      authors: [],
      year: 2025,
      journalTa: "Aesthet Surg J",
      abstract: "A key limitation of this study is the short follow-up",
      publicationTypes: [],
      level: "other",
    },
    "filler",
    "2026-11-01T00:00:00Z"
  );
});
afterAll(() => env.cleanup());

const json = (method: string, body: unknown) =>
  new Request("http://t/api", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const ctx = (pmid: string) => ({ params: Promise.resolve({ pmid }) });

describe("analyze route", () => {
  it("analyzes once, then answers 409; unknown papers are 404", async () => {
    const first = await analyze.POST(new Request("http://t/api", { method: "POST" }), ctx("900"));
    expect(first.status).toBe(200);
    expect((await first.json()).paper.status).toBe("analyzed");
    expect((await analyze.POST(new Request("http://t/api", { method: "POST" }), ctx("900"))).status).toBe(409);
    expect((await analyze.POST(new Request("http://t/api", { method: "POST" }), ctx("999"))).status).toBe(404);
  });
});

describe("review route", () => {
  it("sets review status and validates input", async () => {
    const ok = await review.PATCH(json("PATCH", { reviewStatus: "reviewed" }), ctx("900"));
    expect((await ok.json()).paper.reviewStatus).toBe("reviewed");
    expect((await review.PATCH(json("PATCH", { reviewStatus: "nope" }), ctx("900"))).status).toBe(400);
    expect((await review.PATCH(json("PATCH", { reviewStatus: "reviewed" }), ctx("999"))).status).toBe(404);
  });
});

describe("journals route", () => {
  it("updates an IF, allows clearing it, and rejects bad values", async () => {
    s.ensureJournals();
    const ok = await journals.PATCH(json("PATCH", { ta: "Aesthet Surg J", impactFactor: 3.7 }));
    expect(ok.status).toBe(200);
    expect(s.listJournals().find((j) => j.ta === "Aesthet Surg J")?.impactFactor).toBe(3.7);
    expect((await journals.PATCH(json("PATCH", { ta: "Aesthet Surg J", impactFactor: null }))).status).toBe(200);
    expect((await journals.PATCH(json("PATCH", { ta: "Aesthet Surg J", impactFactor: -1 }))).status).toBe(400);
    expect((await journals.PATCH(json("PATCH", { ta: "Nope", impactFactor: 1 }))).status).toBe(404);
  });
});

describe("sync route", () => {
  it("starts in the background and validates the kind", async () => {
    const started = await sync.POST(json("POST", { kind: "manual" }));
    expect(started.status).toBe(202);
    expect((await started.json()).run.kind).toBe("manual");
    expect((await sync.POST(json("POST", { kind: "other" }))).status).toBe(400);
    await expect.poll(async () => (await (await sync.GET()).json()).run?.finishedAt, { timeout: 5000 }).toBeTruthy();
  });

  it("refuses while another run is active", async () => {
    const active = s.startRun("manual", new Date().toISOString());
    expect((await sync.POST(json("POST", { kind: "manual" }))).status).toBe(409);
    s.finishRun(active.id, { added: 0, analyzed: 0, error: null }, new Date().toISOString());
  });
});
