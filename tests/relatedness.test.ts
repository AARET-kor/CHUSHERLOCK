import { describe, expect, it } from "vitest";
import {
  buildRelatednessPrompt,
  findSemanticRelatedIds,
  type RelatednessCaller,
} from "../lib/ai/relatedness";

const input = {
  newNote: {
    title: "필러 혈관 폐색 초기 대응",
    content: "hyaluronidase 프로토콜...",
    categoryLabel: "혈관 폐색 / Vascular Occlusion",
  },
  candidates: [
    { id: "a", title: "혈관 폐색 감별 진단", excerpt: "capillary refill..." },
    { id: "b", title: "레이저 토닝 파라미터", excerpt: "1064nm..." },
  ],
};

describe("buildRelatednessPrompt", () => {
  it("includes the new note and every candidate", () => {
    const prompt = buildRelatednessPrompt(input);
    expect(prompt).toContain("필러 혈관 폐색 초기 대응");
    expect(prompt).toContain('id="a"');
    expect(prompt).toContain('id="b"');
    expect(prompt).toContain("확실하지 않으면 제외");
  });
});

describe("findSemanticRelatedIds", () => {
  it("returns the caller's judgement", async () => {
    const caller: RelatednessCaller = async () => ["a"];
    expect(await findSemanticRelatedIds(input, caller)).toEqual(["a"]);
  });

  it("returns [] when there are no candidates", async () => {
    const caller: RelatednessCaller = async () => {
      throw new Error("should not be called");
    };
    expect(
      await findSemanticRelatedIds({ ...input, candidates: [] }, caller)
    ).toEqual([]);
  });

  it("degrades to [] instead of throwing when the model call fails", async () => {
    const caller: RelatednessCaller = async () => {
      throw new Error("no API key");
    };
    expect(await findSemanticRelatedIds(input, caller)).toEqual([]);
  });
});
