import { describe, expect, it } from "vitest";
import { chunkDocument } from "../lib/ingest/chunk";

describe("chunkDocument", () => {
  it("keeps a short document as a single chunk", () => {
    const chunks = chunkDocument("짧은 문서입니다.\n\n두 번째 문단.");
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toContain("짧은 문서입니다.");
  });

  it("never exceeds the max chunk size", () => {
    const paragraph = "문장입니다. ".repeat(200);
    const text = Array.from({ length: 30 }, () => paragraph).join("\n\n");
    const chunks = chunkDocument(text, 5000);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(5000);
    }
  });

  it("preserves document order", () => {
    const text = Array.from({ length: 50 }, (_, i) => `단락 ${i} — ${"내용 ".repeat(100)}`).join(
      "\n\n"
    );
    const chunks = chunkDocument(text, 3000);
    const joined = chunks.join("\n\n");
    let lastIndex = -1;
    for (let i = 0; i < 50; i++) {
      const index = joined.indexOf(`단락 ${i} `);
      expect(index).toBeGreaterThan(lastIndex);
      lastIndex = index;
    }
  });

  it("splits a single oversized block instead of dropping it", () => {
    const huge = "한 문장입니다. ".repeat(2000); // no blank lines at all
    const chunks = chunkDocument(huge, 4000);
    expect(chunks.length).toBeGreaterThan(1);
    const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
    expect(totalLength).toBeGreaterThan(huge.length * 0.9);
  });

  it("prefers starting a new chunk at a heading once reasonably full", () => {
    const section = (title: string) => `# ${title}\n\n${"본문 내용. ".repeat(150)}`;
    const text = [section("Chapter 1"), section("Chapter 2"), section("Chapter 3")].join("\n\n");
    const chunks = chunkDocument(text, 2500);
    const startsWithHeading = chunks.filter((c) => c.startsWith("# Chapter")).length;
    expect(startsWithHeading).toBeGreaterThanOrEqual(2);
  });
});
