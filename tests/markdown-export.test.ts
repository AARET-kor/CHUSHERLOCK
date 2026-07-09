import { describe, expect, it } from "vitest";
import { entriesToMarkdownFiles, entryToMarkdown } from "../lib/codex/markdown-export";
import type { CodexEntry } from "../lib/codex/types";

function makeEntry(overrides: Partial<CodexEntry> = {}): CodexEntry {
  return {
    id: "entry-1",
    title: "필러 혈관 폐색 응급 대응",
    content: "Vascular occlusion 의심 시 즉시 hyaluronidase를 투여합니다...",
    categoryKey: "vascular-occlusion",
    tier: "deep_study",
    tags: ["emergency"],
    sources: [
      { id: "src-1", type: "paper", citation: "DeLorenzi 2017", url: "https://example.com/paper" },
    ],
    relatedEntryIds: [],
    status: "draft",
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("entryToMarkdown", () => {
  it("places the file under its full category path", () => {
    const file = entryToMarkdown(makeEntry(), new Map());
    expect(file.relativePath).toBe("complications/vascular-occlusion/필러 혈관 폐색 응급 대응.md");
  });

  it("includes frontmatter with tier, category, and sources", () => {
    const file = entryToMarkdown(makeEntry(), new Map());
    expect(file.content).toContain("tier: deep_study");
    expect(file.content).toContain("category: \"complications/vascular-occlusion\"");
    expect(file.content).toContain("DeLorenzi 2017");
  });

  it("never truncates the body content", () => {
    const longContent = "매우 긴 임상 설명입니다. ".repeat(50);
    const file = entryToMarkdown(makeEntry({ content: longContent }), new Map());
    expect(file.content).toContain(longContent.trim());
  });

  it("renders related entries as wikilinks using their titles", () => {
    const entry = makeEntry({ relatedEntryIds: ["entry-2"] });
    const titleById = new Map([["entry-2", "Hyaluronidase 용량 프로토콜"]]);
    const file = entryToMarkdown(entry, titleById);
    expect(file.content).toContain("[[Hyaluronidase 용량 프로토콜]]");
  });
});

describe("entriesToMarkdownFiles", () => {
  it("cross-links related entries by title across the whole batch", () => {
    const a = makeEntry({ id: "a", title: "A", relatedEntryIds: ["b"] });
    const b = makeEntry({ id: "b", title: "B", relatedEntryIds: ["a"] });
    const files = entriesToMarkdownFiles([a, b]);
    expect(files[0]!.content).toContain("[[B]]");
    expect(files[1]!.content).toContain("[[A]]");
  });
});
