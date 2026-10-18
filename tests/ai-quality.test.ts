import { describe, expect, it } from "vitest";
import { evaluateIngestQuality } from "../lib/ai/evaluation";
import type { SuggestedEntry } from "../lib/ai/schemas";

const source = `[[페이지 12]]
The recommended dose was 10 mg. Stop treatment when blanching appears.
This recommendation is based on expert consensus.`;

function suggestion(): SuggestedEntry {
  return {
    title: "Dose and stop signal",
    categoryKey: "test",
    tier: "procedure_tip",
    tags: ["dose"],
    content:
      "## 용량\n권장 용량은 **10 mg**이다.\n\n> **주의** blanching이 나타나면 즉시 중단한다.",
    sourceLocation: "Dose section",
    figureIds: [],
    claims: [
      {
        claimText: "권장 용량은 10 mg이다.",
        representation: "ai_paraphrase",
        originalQuote: "The recommended dose was 10 mg.",
        sourceLocation: "Dose section",
        pageStart: 12,
        pageEnd: 12,
        section: "Dose",
        evidenceLevel: "expert_consensus",
        conflictStatus: "none",
        conflictNote: "",
      },
      {
        claimText: "blanching이 나타나면 즉시 중단한다.",
        representation: "ai_paraphrase",
        originalQuote: "Stop treatment when blanching appears.",
        sourceLocation: "Dose section",
        pageStart: 12,
        pageEnd: 12,
        section: "Stop signal",
        evidenceLevel: "expert_consensus",
        conflictStatus: "none",
        conflictNote: "",
      },
      {
        claimText: "권고의 근거는 전문가 합의다.",
        representation: "ai_paraphrase",
        originalQuote: "This recommendation is based on expert consensus.",
        sourceLocation: "Dose section",
        pageStart: 12,
        pageEnd: 12,
        section: "Evidence",
        evidenceLevel: "expert_consensus",
        conflictStatus: "none",
        conflictNote: "",
      },
    ],
  };
}

describe("offline AI quality regression gate", () => {
  it("accepts grounded claims with page anchors and number coverage", () => {
    expect(evaluateIngestQuality(source, [suggestion()])).toEqual([]);
  });

  it("detects invented quotes, missing pages, marker leaks, and uncovered numbers", () => {
    const bad = suggestion();
    bad.content += "\n[[페이지 12]] 추가 수치는 **25 mg**이다.";
    bad.claims[0] = {
      ...bad.claims[0]!,
      originalQuote: "This quote does not exist.",
      pageStart: null,
    };
    const codes = evaluateIngestQuality(source, [bad]).map((issue) => issue.code);
    expect(codes).toEqual(
      expect.arrayContaining([
        "invented_quote",
        "missing_page",
        "page_marker_leak",
        "uncovered_number",
      ])
    );
  });
});
