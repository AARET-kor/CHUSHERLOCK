// tests/papers-service.test.ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PaperAnalysis, PaperRecord } from "../lib/papers/types";
import { setupTempDb } from "./helpers/tempDb";

let env: Awaited<ReturnType<typeof setupTempDb>>;
let s: typeof import("../lib/services/paperService");

beforeAll(async () => {
  env = await setupTempDb("papers-service");
  s = await import("../lib/services/paperService");
  s.ensureJournals();
});
afterAll(() => env.cleanup());

const record = (pmid: string, over: Partial<PaperRecord> = {}): PaperRecord => ({
  pmid,
  doi: `10.1/${pmid}`,
  pmcid: null,
  title: `Title ${pmid}`,
  authors: ["Kim A"],
  year: 2024,
  journalTa: "Aesthet Surg J",
  abstract: "Abstract",
  publicationTypes: ["Journal Article"],
  level: "other",
  ...over,
});

const analysis: PaperAnalysis = {
  source: "abstract",
  subject: { kind: "human", detail: "성인", n: 10 },
  material: "HA",
  followUp: null,
  findings: [],
  limitations: [],
  canClaim: [],
  cannotClaim: [],
  implications: [],
};

describe("journals", () => {
  it("seeds once and keeps an edited IF when seeding again", () => {
    s.updateJournal("Aesthet Surg J", { impactFactor: 4.2 });
    s.ensureJournals(true);
    const journal = s.listJournals().find((j) => j.ta === "Aesthet Surg J")!;
    expect(journal).toMatchObject({ impactFactor: 4.2, edited: true });
  });
  it("returns false for an unknown journal", () => {
    expect(s.updateJournal("Nope", { impactFactor: 1 })).toBe(false);
  });
});

describe("upsertPaper", () => {
  it("adds once and merges topics without touching analysis state", () => {
    expect(s.upsertPaper(record("100"), "filler", "2026-11-04T00:00:00Z")).toBe(true);
    expect(s.claimPaper("100", "2026-11-04T00:00:00Z")).toBe(true);
    s.saveAnalysis("100", analysis, "m", "2026-11-04T00:00:00Z");
    expect(s.upsertPaper(record("100"), "thread", "2026-11-05T00:00:00Z")).toBe(false);
    expect(s.getPaper("100")).toMatchObject({ topics: ["filler", "thread"], status: "analyzed", analysisModel: "m" });
  });
  it("treats the same DOI under a new PMID as the same paper", () => {
    s.upsertPaper(record("101", { doi: "10.1/same" }), "filler", "2026-11-04T00:00:00Z");
    expect(s.upsertPaper(record("102", { doi: "10.1/same" }), "energy", "2026-11-04T00:00:00Z")).toBe(false);
    expect(s.getPaper("102")).toBeNull();
    expect(s.getPaper("101")?.topics).toEqual(["filler", "energy"]);
  });
});

describe("claimPaper", () => {
  it("lets only one caller start, and never an analyzed paper", () => {
    s.upsertPaper(record("110"), "filler", "2026-11-04T00:00:00Z");
    expect(s.claimPaper("110", "2026-11-04T00:00:00Z")).toBe(true);
    expect(s.claimPaper("110", "2026-11-04T00:00:00Z")).toBe(false);
    s.saveAnalysis("110", analysis, "m", "2026-11-04T00:00:00Z");
    expect(s.claimPaper("110", "2026-11-04T00:00:00Z")).toBe(false);
    expect(s.getPaper("110")?.attempts).toBe(1);
  });
  it("allows a retry after failure and recovers stuck rows", () => {
    s.upsertPaper(record("111"), "filler", "2026-11-04T00:00:00Z");
    s.claimPaper("111", "2026-11-04T00:00:00Z");
    s.failAnalysis("111", "boom");
    expect(s.getPaper("111")).toMatchObject({ status: "failed", error: "boom" });
    expect(s.claimPaper("111", "2026-11-04T00:00:00Z")).toBe(true);
    expect(s.recoverStuck(new Date("2026-11-04T00:05:00Z"))).toBe(0);
    expect(s.recoverStuck(new Date("2026-11-04T00:11:00Z"))).toBe(1);
    expect(s.getPaper("111")?.status).toBe("failed");
  });
});

describe("listPapers", () => {
  it("sorts by IF with unknown journals last, and filters", () => {
    s.upsertPaper(record("120", { journalTa: "J Am Acad Dermatol" }), "pigment", "2026-11-04T00:00:00Z");
    s.upsertPaper(record("121", { journalTa: "Unknown J" }), "pigment", "2026-11-04T00:00:00Z");
    s.upsertPaper(record("122", { journalTa: "Dermatol Surg", level: "rct" }), "pigment", "2026-11-04T00:00:00Z");
    const { rows, total } = s.listPapers({ topic: "pigment" });
    expect(total).toBe(3);
    expect(rows.map((p) => p.pmid)).toEqual(["120", "122", "121"]);
    expect(s.listPapers({ topic: "pigment", level: "rct" }).rows.map((p) => p.pmid)).toEqual(["122"]);
    expect(s.listPapers({ analysis: "analyzed", subject: "human" }).rows.map((p) => p.pmid)).toContain("100");
  });
});

describe("weeklyQueue and consult candidates", () => {
  it("queues only unanalyzed papers", () => {
    const pmids = s.weeklyQueue().map((q) => q.pmid);
    expect(pmids).toContain("120");
    expect(pmids).not.toContain("100");
  });

  it("builds a block for a case, marking library papers", () => {
    s.upsertPaper(record("130", { title: "Laser paper", journalTa: "J Am Acad Dermatol" }), "pigment", "2026-11-04T00:00:00Z");
    const block = s.literatureForCase({ procedures: ["피코토닝"], conditions: [] }, "2026-11-04T00:00:00Z")!;
    expect(block.papers.length).toBeLessThanOrEqual(5);
    expect(block.papers[0]).toMatchObject({ library: true, impactFactor: expect.any(Number) });
    expect(block.pubmedQuery).toBe("");
  });

  it("leaves excluded papers out, and returns nothing for an unmatched case", () => {
    s.setReview("130", "excluded", "2026-11-04T00:00:00Z");
    const block = s.literatureForCase({ procedures: ["피코토닝"], conditions: [] }, "2026-11-04T00:00:00Z")!;
    expect(block.papers.map((p) => p.pmid)).not.toContain("130");
    expect(s.literatureForCase({ procedures: ["교근 보톡스"], conditions: [] }, "2026-11-04T00:00:00Z")).toBeUndefined();
  });
});

describe("sync runs", () => {
  it("tracks the last successful start and weekly attempts", () => {
    const run = s.startRun("weekly", "2026-11-01T00:00:00Z");
    expect(s.activeRun(new Date("2026-11-01T00:30:00Z"))?.id).toBe(run.id);
    s.finishRun(run.id, { added: 3, analyzed: 2, error: null }, "2026-11-01T01:00:00Z");
    expect(s.activeRun(new Date("2026-11-01T02:00:00Z"))).toBeNull();
    expect(s.lastSuccessfulStart()).toBe("2026-11-01T00:00:00Z");
    expect(s.weeklyAttemptsSince("2026-10-30T00:00:00Z")).toBe(2);
    const failed = s.startRun("manual", "2026-11-02T00:00:00Z");
    s.finishRun(failed.id, { added: 0, analyzed: 0, error: "down" }, "2026-11-02T00:01:00Z");
    expect(s.lastSuccessfulStart()).toBe("2026-11-01T00:00:00Z");
    expect(s.latestRun()?.error).toBe("down");
  });
});
