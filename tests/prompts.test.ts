import { describe, expect, it } from "vitest";
import { buildJobPrefix, buildChunkTurn, buildChunkPrompt, buildSystemPrompt } from "../lib/ai/prompts";

const input = {
  sourceLabel: "test.pdf",
  sourceCitation: "Test Citation 2026",
  formatNote: "PDF",
  chunkIndex: 2,
  totalChunks: 5,
  contextSummary: "지금까지의 요약",
  chunkText: "본문 텍스트",
  figures: [{ id: "fig-1", page: 3, kind: "figure", caption: "주입점" }],
};

describe("prompt structure (caching)", () => {
  it("job prefix is chunk-independent so it can be cached across chunks", () => {
    const a = buildJobPrefix(input);
    const b = buildJobPrefix({
      ...input,
      ...{ chunkIndex: 4, contextSummary: "다른 요약", chunkText: "다른 본문" },
    });
    expect(a).toBe(b);
    expect(a).toContain("Test Citation 2026");
    expect(a).toContain('fig-1');
    expect(a).not.toContain("chunk 3");
  });

  it("volatile turn carries progress, rolling summary, and chunk text", () => {
    const turn = buildChunkTurn(input);
    expect(turn).toContain("chunk 3 / 5");
    expect(turn).toContain("지금까지의 요약");
    expect(turn).toContain("본문 텍스트");
  });

  it("buildChunkPrompt composes prefix + turn", () => {
    const full = buildChunkPrompt(input);
    expect(full).toContain(buildJobPrefix(input));
    expect(full).toContain(buildChunkTurn(input));
  });

  it("system prompt asks for the summary-first note format", () => {
    const system = buildSystemPrompt();
    expect(system).toContain("한눈에 보기");
    expect(system).toContain("3-4");
  });
});
