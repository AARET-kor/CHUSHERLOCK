import { describe, expect, it } from "vitest";
import { pageMarker } from "../lib/ingest/extract";
import { buildSystemPrompt, buildJobPrefix } from "../lib/ai/prompts";

describe("page anchoring for figure matching", () => {
  it("pageMarker has a stable, parseable format", () => {
    expect(pageMarker(5)).toBe("[[페이지 5]]");
  });

  it("system prompt instructs page-based figure matching", () => {
    const sys = buildSystemPrompt();
    expect(sys).toContain("[[페이지 N]]");
    expect(sys).toContain("PAGE"); // "Match figures to entries by PAGE"
    // must tell the model NOT to leak markers into note bodies
    expect(sys).toContain("Do NOT copy");
  });

  it("figure list in the job prefix exposes each figure's page number", () => {
    const prefix = buildJobPrefix({
      sourceLabel: "x.pdf",
      sourceCitation: "cite",
      formatNote: "PDF",
      figures: [{ id: "f1", page: 7, kind: "figure", caption: "확산 비교 표" }],
    });
    expect(prefix).toContain('page="7"');
    expect(prefix).toContain("확산 비교 표");
  });
});
