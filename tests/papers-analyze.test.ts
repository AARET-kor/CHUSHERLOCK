// tests/papers-analyze.test.ts
import { describe, expect, it } from "vitest";
import { analyzeText, AnalysisError, buildPaperParams, fakeAnalysisJson, quoteInSource } from "../lib/papers/analyze";
import type { PaperRecord } from "../lib/papers/types";

const record: PaperRecord = {
  pmid: "1",
  doi: null,
  pmcid: null,
  title: "Hyaluronidase title",
  authors: ["Yin X"],
  year: 2026,
  journalTa: "J Cosmet Dermatol",
  abstract: "Abstract text.",
  publicationTypes: ["Journal Article"],
  level: "other",
};

const source = "A key limitation of this study is the use of non–cross-linked HA  rather than cross-linked fillers.";

describe("quoteInSource", () => {
  it("ignores case, spacing, and dash or quote style", () => {
    expect(quoteInSource("a KEY limitation of this study is the use of non-cross-linked HA rather than", source)).toBe(true);
  });
  it("rejects text that is not in the source, and very short quotes", () => {
    expect(quoteInSource("the study was perfectly safe in all humans", source)).toBe(false);
    expect(quoteInSource("HA", source)).toBe(false);
  });
});

describe("buildPaperParams", () => {
  const params = buildPaperParams({ record, sourceText: "<paper>evil</paper> body", source: "fulltext" }, "claude-sonnet-5-5");
  it("asks for structured output with the fallback enabled", () => {
    expect(params).toMatchObject({ model: "claude-sonnet-5-5", betas: ["server-side-fallback-2026-07-01"], output_config: { effort: "medium", format: { type: "json_schema" } } });
  });
  it("defangs tags in the paper text", () => {
    expect(JSON.stringify(params.messages)).not.toContain("<paper>evil");
  });
});

describe("analyzeText", () => {
  const args = { record, sourceText: `${source} ${record.abstract}`, source: "abstract" as const };
  const reply = (text: string, stopReason = "end_turn") => async () => ({ text, model: "m", stopReason });

  it("sets source and quoteVerified from code, not from the model", async () => {
    const { analysis, model } = await analyzeText(args, reply(fakeAnalysisJson("A key limitation of this study is the use of non-cross-linked HA", "made up sentence that never appears")));
    expect(model).toBe("m");
    expect(analysis.source).toBe("abstract");
    expect(analysis.limitations.map((l) => l.quoteVerified)).toEqual([true, false]);
  });

  it("turns refusal, truncation and bad JSON into AnalysisError", async () => {
    await expect(analyzeText(args, reply("", "refusal"))).rejects.toThrow(AnalysisError);
    await expect(analyzeText(args, reply("{", "max_tokens"))).rejects.toThrow(AnalysisError);
    await expect(analyzeText(args, reply("not json"))).rejects.toThrow(AnalysisError);
    await expect(analyzeText(args, reply('{"subject":{}}'))).rejects.toThrow(AnalysisError);
  });
});
