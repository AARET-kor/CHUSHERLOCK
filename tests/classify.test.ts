import { describe, expect, it } from "vitest";
import { processDocument, fakeChunkCaller, type ChunkCaller } from "../lib/ai/classify";
import { buildChunkPrompt, buildSystemPrompt } from "../lib/ai/prompts";
import { chunkResultSchema } from "../lib/ai/schemas";
import { getLeafCategories } from "../lib/codex/taxonomy";

describe("processDocument", () => {
  it("carries the rolling context summary between chunks in order", async () => {
    const seenSummaries: string[] = [];
    const caller: ChunkCaller = async (input) => {
      seenSummaries.push(input.contextSummary);
      return {
        entries: [
          {
            title: `entry ${input.chunkIndex}`,
            categoryKey: "botox",
            tier: "procedure_tip",
            tags: ["t"],
            content: "내용",
            sourceLocation: `chunk ${input.chunkIndex}`,
          },
        ],
        contextSummary: `summary-after-${input.chunkIndex}`,
      };
    };

    const longText = Array.from({ length: 10 }, (_, i) => `단락 ${i} ${"내용 ".repeat(800)}`).join(
      "\n\n"
    );
    const result = await processDocument(
      { text: longText, sourceLabel: "test", sourceCitation: "cite", formatNote: "txt" },
      { caller }
    );

    expect(result.chunkCount).toBeGreaterThan(1);
    expect(seenSummaries[0]).toBe("");
    for (let i = 1; i < seenSummaries.length; i++) {
      expect(seenSummaries[i]).toBe(`summary-after-${i - 1}`);
    }
    expect(result.suggestions).toHaveLength(result.chunkCount);
  });

  it("reports progress after each chunk", async () => {
    const progress: Array<[number, number]> = [];
    const longText = Array.from({ length: 6 }, () => "내용 ".repeat(2000)).join("\n\n");
    await processDocument(
      { text: longText, sourceLabel: "t", sourceCitation: "c", formatNote: "txt" },
      { caller: fakeChunkCaller, onProgress: (p, t) => void progress.push([p, t]) }
    );
    expect(progress.length).toBeGreaterThan(1);
    const [lastProcessed, lastTotal] = progress[progress.length - 1]!;
    expect(lastProcessed).toBe(lastTotal);
  });

  it("rejects an empty document", async () => {
    await expect(
      processDocument(
        { text: "   ", sourceLabel: "t", sourceCitation: "c", formatNote: "txt" },
        { caller: fakeChunkCaller }
      )
    ).rejects.toThrow();
  });

  it("fake caller output validates against the chunk result schema", async () => {
    const result = await fakeChunkCaller({
      sourceLabel: "t",
      sourceCitation: "c",
      formatNote: "txt",
      chunkIndex: 0,
      totalChunks: 1,
      contextSummary: "",
      chunkText: "테스트 내용입니다.",
    });
    expect(() => chunkResultSchema.parse(result)).not.toThrow();
  });
});

describe("prompts", () => {
  it("system prompt lists every leaf category key and all four tiers", () => {
    const prompt = buildSystemPrompt();
    for (const category of getLeafCategories()) {
      expect(prompt).toContain(`- ${category.key}:`);
    }
    for (const tier of [
      "procedure_tip",
      "chairside_talk",
      "deep_study",
      "base_medical_knowledge",
    ]) {
      expect(prompt).toContain(tier);
    }
    expect(prompt).toContain("DO NOT over-summarize");
  });

  it("chunk prompt embeds metadata, context, and the chunk text", () => {
    const prompt = buildChunkPrompt({
      sourceLabel: "필러 교과서.pdf",
      sourceCitation: "Filler Textbook 2024",
      formatNote: "PDF, 300 pages",
      chunkIndex: 2,
      totalChunks: 10,
      contextSummary: "1장은 해부학 개요였음",
      chunkText: "본문 텍스트",
    });
    expect(prompt).toContain("필러 교과서.pdf");
    expect(prompt).toContain("chunk 3 / 10");
    expect(prompt).toContain("1장은 해부학 개요였음");
    expect(prompt).toContain("본문 텍스트");
  });
});
