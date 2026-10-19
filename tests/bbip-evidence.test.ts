// tests/bbip-evidence.test.ts
import { describe, expect, it } from "vitest";
import { citedLiterature, citedNoteNumbers, renderEvidenceHtml, toPlainNoteText } from "../lib/bbip/evidence";
import type { LiteratureBlock, NoteRef } from "../lib/bbip/types";

const notes: NoteRef[] = [
  { n: 1, id: "id-1", title: "피코토닝 \"기미\" 프로토콜", categoryLabel: "피코토닝", verified: true },
  { n: 2, id: "id-2", title: "기미 감별", categoryLabel: "기미", verified: true },
  { n: 3, id: "draft-3", title: "BBIP 초안", categoryLabel: "기미", verified: false },
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

  it("badges an unverified BBIP draft as AI but still links to it", () => {
    const html = renderEvidenceHtml("초안 내용 [3]", notes);
    expect(html).toContain(
      '<a class="ev ev-ai" href="/entries/draft-3" title="검토 전 BBIP 초안 — 노트 링크">🤖AI</a>'
    );
    expect(html).not.toContain("ev-note");
    expect(html).not.toContain("📚");
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
    const hostile: NoteRef[] = [
      { n: 1, id: 'x"><img src=x onerror=alert(1)>', title: "t", categoryLabel: "c", verified: true },
    ];
    const html = renderEvidenceHtml("claim [1]", hostile);
    expect(html).not.toContain("<img");
    expect(html).toContain("/entries/x%22%3E%3Cimg");
  });

  it("never emits <img>; images degrade to alt text", () => {
    const html = renderEvidenceHtml("![축소 사진](https://evil.example/p.png)", notes);
    expect(html).not.toContain("<img");
    expect(html).toContain("축소 사진");
    expect(renderEvidenceHtml("![a](/local.png)", notes)).not.toContain("<img");
  });

  it("rejects backslash-prefixed protocol-relative hrefs", () => {
    const html = renderEvidenceHtml("[x](/\\evil.com)", notes);
    expect(html).not.toContain("<a ");
    expect(renderEvidenceHtml("[x](/entries/1)", notes)).toContain('href="/entries/1"');
    expect(renderEvidenceHtml("[x](//evil.com)", notes)).not.toContain("<a ");
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

  it("spells out unverified note markers as AI supplements", () => {
    const unverified = new Set([3]);
    expect(toPlainNoteText("- 확인됨 [1]\n- 초안 [3]", unverified)).toBe("- 확인됨\n- 초안 (AI 보충)");
    expect(toPlainNoteText("[3] 줄머리 초안", unverified)).toBe("(AI 보충) 줄머리 초안");
    expect(toPlainNoteText("둘 다 [1][3]", unverified)).toBe("둘 다 (AI 보충)");
  });

  it("preserves list indentation and blank lines", () => {
    expect(toPlainNoteText("- a\n  - nested [1]\n- b")).toBe("- a\n  - nested\n- b");
    expect(toPlainNoteText("문단.\n\n[1] 다음 문단")).toBe("문단.\n\n다음 문단");
  });
});

const literature: LiteratureBlock = {
  pubmedQuery: "q",
  webQuery: "w",
  papers: [
    {
      pmid: "38000001",
      title: "Pico \"meta\"",
      authors: ["Kim J"],
      year: 2024,
      journal: "JAAD",
      abstract: "",
      publicationTypes: ["Meta-Analysis"],
      level: "meta",
    },
  ],
  web: [
    { url: "https://www.fda.gov/label", title: "FDA label", snippet: "" },
    { url: "javascript:alert(1)", title: "bad", snippet: "" },
  ],
  errors: {},
  fetchedAt: "",
};

describe("literature badges", () => {
  it("links [P#] to PubMed and [W#] to the page", () => {
    const html = renderEvidenceHtml("효과 [P1], 허가 [W1]", notes, literature);
    expect(html).toContain(
      '<a class="ev ev-paper" href="https://pubmed.ncbi.nlm.nih.gov/38000001/" target="_blank" rel="noopener noreferrer" title="Pico &quot;meta&quot; — JAAD · 2024 · 메타분석·SR">🔬P1</a>'
    );
    expect(html).toContain(
      '<a class="ev ev-web" href="https://www.fda.gov/label" target="_blank" rel="noopener noreferrer" title="FDA label">🌐W1</a>'
    );
  });

  it("leaves unknown or unsafe literature markers as text", () => {
    const html = renderEvidenceHtml("x [P9] y [W2] z [P1]", notes);
    expect(html).toContain("[P9]");
    expect(html).toContain("[W2]");
    expect(html).toContain("[P1]");
    expect(renderEvidenceHtml("[W2]", notes, literature)).not.toContain("javascript");
  });

  it("shows a textbook badge for notes backed by a book", () => {
    const withBook = [{ ...notes[0]!, book: { title: "Cosmetic Dermatology Principles", page: 212, claimId: "c 1" } }];
    const html = renderEvidenceHtml("교과서 [1]", withBook);
    expect(html).toContain(
      '<a class="ev ev-book" href="/entries/id-1#claim-c%201" title="📚1 피코토닝 &quot;기미&quot; 프로토콜">📖<i>Cosmetic Dermatology Pr…</i> p.212</a>'
    );
    const draft = [{ ...notes[2]!, book: { title: "Book" } }];
    expect(renderEvidenceHtml("[3]", draft)).toContain("🤖AI");
  });

  it("collects cited literature numbers", () => {
    expect(citedLiterature("a [P2][P1] b [W1] [P2] [1] [AI]")).toEqual({ papers: [1, 2], web: [1] });
  });

  it("spells literature markers out in note text", () => {
    expect(toPlainNoteText("효과 있음 [P1][W1]", new Set(), literature)).toBe("효과 있음 (PMID 38000001) (fda.gov)");
    expect(toPlainNoteText("모름 [P7]", new Set(), literature)).toBe("모름");
  });
});
