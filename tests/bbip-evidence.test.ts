// tests/bbip-evidence.test.ts
import { describe, expect, it } from "vitest";
import { citedNoteNumbers, renderEvidenceHtml, toPlainNoteText } from "../lib/bbip/evidence";
import type { NoteRef } from "../lib/bbip/types";

const notes: NoteRef[] = [
  { n: 1, id: "id-1", title: "피코토닝 \"기미\" 프로토콜", categoryLabel: "피코토닝" },
  { n: 2, id: "id-2", title: "기미 감별", categoryLabel: "기미" },
];

describe("renderEvidenceHtml", () => {
  it("turns [n] into a note badge link", () => {
    const html = renderEvidenceHtml("저출력 반복 [1][2]", notes);
    expect(html).toContain('<a class="ev ev-note" href="/entries/id-1"');
    expect(html).toContain("📚1</a>");
    expect(html).toContain("📚2</a>");
    expect(html).toContain('title="피코토닝 &quot;기미&quot; 프로토콜"');
  });

  it("turns [AI] into an AI badge", () => {
    expect(renderEvidenceHtml("일반 원칙 [AI]", notes)).toContain(
      '<span class="ev ev-ai" title="검증되지 않은 AI 보충">🤖AI</span>'
    );
  });

  it("leaves unknown note numbers as literal text", () => {
    expect(renderEvidenceHtml("근거 [7]", notes)).toContain("[7]");
  });

  it("escapes raw HTML from the model", () => {
    const html = renderEvidenceHtml("<script>alert(1)</script> [1]", notes);
    expect(html).not.toContain("<script>");
  });

  it("renders markdown structure", () => {
    expect(renderEvidenceHtml("## 제목\n- 항목 [AI]", notes)).toContain("<h2>");
  });
});

describe("citedNoteNumbers / toPlainNoteText", () => {
  it("collects unique cited numbers", () => {
    expect(citedNoteNumbers("a [2] b [1][2] c [AI]")).toEqual([1, 2]);
  });

  it("drops note markers and spells out AI markers", () => {
    expect(toPlainNoteText("- 저출력 [1]\n- 일반론 [AI]")).toBe("- 저출력\n- 일반론 (AI 보충)");
  });
});
