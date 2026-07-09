import { describe, expect, it } from "vitest";
import { needsOcr, pageRanges, imageMediaType } from "../lib/ingest/ocr";

describe("needsOcr", () => {
  it("flags a PDF with almost no text per page as scanned", () => {
    expect(needsOcr("p1\np2", 200)).toBe(true);
  });

  it("does not flag a PDF with a normal text layer", () => {
    expect(needsOcr("본문 텍스트입니다. ".repeat(200), 10)).toBe(false);
  });

  it("handles unknown page counts", () => {
    expect(needsOcr("", 0)).toBe(true);
    expect(needsOcr("충분히 긴 텍스트입니다. ".repeat(10), 0)).toBe(false);
  });
});

describe("pageRanges", () => {
  it("covers every page exactly once", () => {
    const ranges = pageRanges(37, 15);
    expect(ranges).toEqual([
      [0, 14],
      [15, 29],
      [30, 36],
    ]);
  });

  it("handles a document smaller than one segment", () => {
    expect(pageRanges(5, 15)).toEqual([[0, 4]]);
  });
});

describe("imageMediaType", () => {
  it("maps common photo extensions", () => {
    expect(imageMediaType("page.JPG")).toBe("image/jpeg");
    expect(imageMediaType("scan.png")).toBe("image/png");
    expect(imageMediaType("doc.pdf")).toBeUndefined();
  });
});
