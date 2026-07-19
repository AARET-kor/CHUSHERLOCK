import { describe, expect, it } from "vitest";
import { tokenize, retrieve, type RetrievableNote } from "../lib/ai/retrieval";

function note(id: string, title: string, content: string, tags: string[] = []): RetrievableNote {
  return { id, title, content, tags, categoryKey: "x" };
}

describe("tokenize", () => {
  it("keeps latin words (≥2), CJK bigrams, and numbers", () => {
    const t = tokenize("혈관폐색 hyaluronidase 24-72");
    expect(t).toContain("혈관"); // bigram
    expect(t).toContain("폐색"); // bigram
    expect(t).toContain("hyaluronidase");
    expect(t).toContain("24");
    expect(t).toContain("72");
  });

  it("emits a bare syllable only for a length-1 CJK word", () => {
    expect(tokenize("무관한")).toEqual(["무관", "관한"]); // no single syllables
    expect(tokenize("물 마시기")).toContain("물"); // length-1 word kept
  });

  it("drops latin single characters as noise", () => {
    expect(tokenize("a b cd")).toEqual(["cd"]);
  });

  it("matches space-less Korean compounds via bigrams", () => {
    // "혈관폐색" (no space) and "혈관 폐색" (spaced) share the 혈관/폐색 bigrams
    const a = new Set(tokenize("혈관폐색"));
    const b = tokenize("혈관 폐색");
    expect(b.some((tok) => a.has(tok))).toBe(true);
  });
});

describe("retrieve", () => {
  const notes = [
    note("vo", "필러 혈관 폐색 응급 대응", "hyaluronidase 고용량 투여, 즉시 중단, 마사지"),
    note("botox", "보톡스 확산과 희석 농도", "finger maneuver로 확산 방향 조절"),
    note("laser", "레이저 토닝 파라미터", "제네시스 세팅과 간격"),
  ];

  it("ranks the on-topic note first", () => {
    const r = retrieve("혈관 폐색 시 hyaluronidase 응급 용량", notes);
    expect(r[0]!.note.id).toBe("vo");
    expect(r[0]!.score).toBeGreaterThan(0);
  });

  it("returns nothing when no token overlaps", () => {
    expect(retrieve("완전히 무관한 zzzzq 질문", notes)).toHaveLength(0);
  });

  it("respects the limit", () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      note(`n${i}`, `보톡스 노트 ${i}`, "보톡스 확산 내용")
    );
    expect(retrieve("보톡스 확산", many, 5)).toHaveLength(5);
  });

  it("empty corpus yields no results", () => {
    expect(retrieve("보톡스", [])).toHaveLength(0);
  });
});
