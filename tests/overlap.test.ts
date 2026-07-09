import { describe, expect, it } from "vitest";
import { findOverlapCandidates, titleSimilarity } from "../lib/codex/overlap";

describe("titleSimilarity", () => {
  it("is 1 for identical titles", () => {
    expect(titleSimilarity("필러 혈관 폐색", "필러 혈관 폐색")).toBe(1);
  });

  it("is 0 for unrelated titles", () => {
    expect(titleSimilarity("보톡스 파라미터", "리쥬란 시술 팁")).toBe(0);
  });

  it("is partial for overlapping-but-not-identical titles", () => {
    const score = titleSimilarity("필러 혈관 폐색 대응", "필러 혈관 폐색 응급처치");
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });
});

describe("findOverlapCandidates", () => {
  const existing = [
    { id: "1", title: "필러 혈관 폐색 대응", categoryKey: "vascular-occlusion" },
    { id: "2", title: "보톡스 파라미터 정리", categoryKey: "botox" },
  ];

  it("only matches within the same category", () => {
    const candidates = findOverlapCandidates("필러 혈관 폐색 응급처치", "botox", existing);
    expect(candidates).toHaveLength(0);
  });

  it("finds a same-category, similar-title match", () => {
    const candidates = findOverlapCandidates("필러 혈관 폐색 응급처치", "vascular-occlusion", existing);
    expect(candidates.map((c) => c.id)).toContain("1");
  });
});
