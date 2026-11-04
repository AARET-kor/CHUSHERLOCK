// tests/papers-run.test.ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PaperRecord } from "../lib/papers/types";
import { setupTempDb } from "./helpers/tempDb";

let env: Awaited<ReturnType<typeof setupTempDb>>;
let run: typeof import("../lib/papers/run");
let s: typeof import("../lib/services/paperService");
let analyze: typeof import("../lib/papers/analyze");

beforeAll(async () => {
  env = await setupTempDb("papers-run");
  run = await import("../lib/papers/run");
  s = await import("../lib/services/paperService");
  analyze = await import("../lib/papers/analyze");
});
afterAll(() => env.cleanup());

const record = (pmid: string, journalTa = "Aesthet Surg J"): PaperRecord => ({
  pmid,
  doi: null,
  pmcid: `PMC${pmid}`,
  title: `T${pmid}`,
  authors: [],
  year: 2025,
  journalTa,
  abstract: `Abstract. ${analyzeQuote()}`,
  publicationTypes: ["Journal Article"],
  level: "other",
});
const analyzeQuote = () => "A key limitation of this study is the short follow-up";

function deps(ids: string[], over: Partial<import("../lib/papers/run").PaperDeps> = {}) {
  const calls = { model: 0, search: [] as string[], fetched: [] as string[][] };
  const value: import("../lib/papers/run").PaperDeps = {
    search: async (term) => {
      calls.search.push(term);
      return ids;
    },
    fetchRecords: async (pmids) => {
      calls.fetched.push(pmids);
      return pmids.map((pmid) => record(pmid));
    },
    fullText: async () => null,
    callModel: async () => {
      calls.model += 1;
      return { text: analyze.fakeAnalysisJson(), model: "m", stopReason: "end_turn" };
    },
    now: () => new Date("2026-11-02T06:00:00Z"),
    ...over,
  };
  return { value, calls };
}

describe("analyzeOne", () => {
  it("analyzes once and refuses a second time without calling the model", async () => {
    const { value, calls } = deps([]);
    s.upsertPaper(record("500"), "filler", "2026-11-01T00:00:00Z");
    await run.analyzeOne("500", value);
    expect(s.getPaper("500")).toMatchObject({ status: "analyzed", analysisModel: "m" });
    await expect(run.analyzeOne("500", value)).rejects.toThrow(run.AlreadyAnalyzedError);
    expect(calls.model).toBe(1);
  });

  it("uses full text when PMC has it and falls back to the abstract", async () => {
    s.upsertPaper(record("501"), "filler", "2026-11-01T00:00:00Z");
    s.upsertPaper(record("502"), "filler", "2026-11-01T00:00:00Z");
    const seen: string[] = [];
    const { value } = deps([], {
      fullText: async (pmcid) => (pmcid === "PMC501" ? `BODY ${"x".repeat(600)}` : null),
      callModel: async (params) => {
        seen.push(JSON.stringify(params.messages));
        return { text: analyze.fakeAnalysisJson(), model: "m", stopReason: "end_turn" };
      },
    });
    await run.analyzeOne("501", value);
    await run.analyzeOne("502", value);
    expect(seen[0]).toContain("논문 전문");
    expect(seen[1]).toContain("초록만");
    expect(s.getPaper("501")?.analysis?.source).toBe("fulltext");
    expect(s.getPaper("502")?.analysis?.source).toBe("abstract");
  });

  it("records a failure without saving an analysis, then allows a retry", async () => {
    s.upsertPaper(record("503"), "filler", "2026-11-01T00:00:00Z");
    const { value } = deps([], { callModel: async () => ({ text: "", model: "m", stopReason: "refusal" }) });
    await expect(run.analyzeOne("503", value)).rejects.toThrow(analyze.AnalysisError);
    expect(s.getPaper("503")).toMatchObject({ status: "failed", analysis: null });
    await run.analyzeOne("503", deps([]).value);
    expect(s.getPaper("503")?.status).toBe("analyzed");
  });
});

describe("pen marks", () => {
  const marksReply = (text: string) => async () => ({
    text: JSON.stringify({ marks: [{ text, pen: "red" }] }),
    model: "m",
    stopReason: "end_turn",
  });

  it("saves verified marks with a new analysis", async () => {
    s.upsertPaper(record("540"), "filler", "2026-11-01T00:00:00Z");
    await run.analyzeOne("540", deps([], { callMarks: marksReply("추적 기간이 짧음") }).value);
    expect(s.getPaper("540")?.analysis?.marks).toEqual([{ text: "추적 기간이 짧음", pen: "red" }]);
  });

  it("keeps the analysis when marking fails", async () => {
    s.upsertPaper(record("541"), "filler", "2026-11-01T00:00:00Z");
    const callMarks = async () => {
      throw new Error("overloaded");
    };
    await run.analyzeOne("541", deps([], { callMarks }).value);
    expect(s.getPaper("541")).toMatchObject({ status: "analyzed", error: null });
    expect(s.getPaper("541")?.analysis?.marks).toBeUndefined();
  });

  it("marks older analyses without changing their text or date, and only once", async () => {
    s.upsertPaper(record("542"), "filler", "2026-11-01T00:00:00Z");
    const { value, calls } = deps([]);
    await run.analyzeOne("542", value);
    const before = s.getPaper("542")!;
    let markCalls = 0;
    const reply = marksReply("인과관계를 증명하지는 못함");
    const callMarks = async () => {
      markCalls += 1;
      return reply();
    };
    const modelCalls = calls.model;
    expect(await run.markUnmarked(deps([], { callMarks }).value)).toBeGreaterThanOrEqual(1);
    const after = s.getPaper("542")!;
    expect(after.analysis).toEqual({ ...before.analysis, marks: [{ text: "인과관계를 증명하지는 못함", pen: "red" }] });
    expect(after.analyzedAt).toBe(before.analyzedAt);
    expect(after.analysisModel).toBe(before.analysisModel);
    expect(calls.model).toBe(modelCalls);
    const firstPass = markCalls;
    await run.markUnmarked(deps([], { callMarks }).value);
    expect(markCalls).toBe(firstPass);
  });
});

describe("collect", () => {
  it("searches every topic and fetches only papers it does not have", async () => {
    const { value, calls } = deps(["600", "601"]);
    const added = await run.collect(value);
    expect(calls.search).toHaveLength(4);
    expect(calls.fetched).toEqual([["600", "601"]]);
    expect(added).toBe(2);
    expect(s.getPaper("600")?.topics).toEqual(["filler", "thread", "energy", "pigment"]);
  });
});

describe("runSync", () => {
  it("analyzes at most 5 a week, even when triggered twice", async () => {
    const ids = Array.from({ length: 12 }, (_, i) => String(700 + i));
    const first = deps(ids);
    const before = first.calls.model;
    await run.runSync(s.startRun("weekly", "2026-11-02T06:00:00Z"), first.value);
    expect(first.calls.model - before).toBe(5);
    const second = deps([]);
    await run.runSync(s.startRun("weekly", "2026-11-03T06:00:00Z"), { ...second.value, now: () => new Date("2026-11-03T06:00:00Z") });
    expect(second.calls.model).toBe(0);
    expect(s.latestRun()).toMatchObject({ analyzed: 0, error: null });
  });

  it("counts failed attempts against the budget and keeps going", async () => {
    const next = deps([], {
      callModel: async () => ({ text: "not json", model: "m", stopReason: "end_turn" }),
      now: () => new Date("2026-11-20T06:00:00Z"),
    });
    await run.runSync(s.startRun("weekly", "2026-11-20T06:00:00Z"), next.value);
    expect(s.latestRun()).toMatchObject({ analyzed: 5, error: null });
  });

  it("a manual run collects but spends no analyses", async () => {
    const { value, calls } = deps(["800"]);
    await run.runSync(s.startRun("manual", "2026-11-21T06:00:00Z"), value);
    expect(calls.model).toBe(0);
    expect(s.getPaper("800")?.status).toBe("pending");
  });

  it("keeps the resume point when PubMed fails", async () => {
    const good = s.lastSuccessfulStart();
    const { value } = deps([], { search: async () => { throw new Error("PubMed esearch HTTP 500"); } });
    await run.runSync(s.startRun("weekly", "2026-11-22T06:00:00Z"), value);
    expect(s.latestRun()?.error).toContain("500");
    expect(s.lastSuccessfulStart()).toBe(good);
  });
});

describe("startSync", () => {
  it("refuses while another run is active", async () => {
    const { done } = run.startSync("manual", deps([]).value);
    expect(() => run.startSync("manual", deps([]).value)).toThrow(run.SyncRunningError);
    await done;
  });
});
