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

describe("renderEvidenceHtml hardening", () => {
  it("drops unsafe link hrefs", () => {
    const html = renderEvidenceHtml("[click](javascript:alert(1))", notes);
    expect(html).not.toContain("javascript:");
    expect(html).toContain("click");
  });

  it("keeps markers literal inside code spans", () => {
    const html = renderEvidenceHtml("`code [1]`", notes);
    expect(html).toContain("<code>code [1]</code>");
    expect(html).not.toContain("ev-note");
  });

  it("does not badge markers inside link titles", () => {
    const html = renderEvidenceHtml('[x](http://a "t [1]")', notes);
    expect(html).toContain('<a href="http://a" title="t [1]">x</a>');
    expect(html).not.toContain("ev-note");
  });

  it("encodes hostile note ids", () => {
    const hostile: NoteRef[] = [{ n: 1, id: 'x"><img src=x onerror=alert(1)>', title: "t", categoryLabel: "c" }];
    const html = renderEvidenceHtml("claim [1]", hostile);
    expect(html).not.toContain("<img");
    expect(html).toContain("/entries/x%22%3E%3Cimg");
  });

  it("does not double-escape code spans", () => {
    expect(renderEvidenceHtml("`a & b`", notes)).toContain("<code>a &amp; b</code>");
  });

  it("escapes raw HTML but keeps blockquotes", () => {
    expect(renderEvidenceHtml("<script>x</script>", notes)).not.toContain("<script>");
    expect(renderEvidenceHtml("> 인용", notes)).toContain("<blockquote>");
  });
});

describe("emphasis around markers", () => {
  it.each([
    ["**강조[1]**은", "<strong>"],
    ["**강조 [1]**은 중요", "<strong>"],
    ["*기울임 [AI]*입니다", "<em>"],
  ])("keeps emphasis for %s", (source, tag) => {
    const html = renderEvidenceHtml(source, notes);
    expect(html).toContain(tag);
    expect(html).not.toContain("*");
    expect(html).toMatch(/ev-(note|ai)/);
  });
});

describe("citedNoteNumbers / toPlainNoteText", () => {
  it("collects unique cited numbers", () => {
    expect(citedNoteNumbers("a [2] b [1][2] c [AI]")).toEqual([1, 2]);
  });

  it("drops note markers and spells out AI markers", () => {
    expect(toPlainNoteText("- 저출력 [1]\n- 일반론 [AI]")).toBe("- 저출력\n- 일반론 (AI 보충)");
  });

  it("leaves no leading space before a line-start AI marker", () => {
    expect(toPlainNoteText("[AI] b")).toBe("(AI 보충) b");
    expect(toPlainNoteText("a\n[AI] b")).toBe("a\n(AI 보충) b");
  });

  it("preserves list indentation and blank lines", () => {
    expect(toPlainNoteText("- a\n  - nested [1]\n- b")).toBe("- a\n  - nested\n- b");
    expect(toPlainNoteText("문단.\n\n[1] 다음 문단")).toBe("문단.\n\n다음 문단");
  });
});
