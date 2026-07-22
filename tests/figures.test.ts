import { describe, expect, it } from "vitest";
import { clampRegion } from "../lib/ingest/figures";
import { extractPptxText } from "../lib/ingest/extract";
import JSZip from "jszip";

describe("clampRegion", () => {
  const base = { kind: "figure" as const, caption: "c" };

  it("keeps an in-bounds region unchanged", () => {
    const region = clampRegion({ ...base, x: 100, y: 100, width: 300, height: 200 }, 1400, 1900);
    expect(region).toMatchObject({ x: 100, y: 100, width: 300, height: 200 });
  });

  it("clamps a region overflowing the page edge", () => {
    const region = clampRegion({ ...base, x: 1300, y: 1800, width: 400, height: 400 }, 1400, 1900);
    expect(region).toMatchObject({ x: 1300, width: 100, y: 1800, height: 100 });
  });

  it("rejects degenerate/tiny regions", () => {
    expect(clampRegion({ ...base, x: 0, y: 0, width: 20, height: 20 }, 1400, 1900)).toBeNull();
    expect(clampRegion({ ...base, x: 1390, y: 0, width: 500, height: 500 }, 1400, 1900)).toBeNull();
  });

  it("rejects non-finite coords instead of producing a NaN box", () => {
    expect(clampRegion({ ...base, x: NaN, y: 0, width: 300, height: 300 }, 1400, 1900)).toBeNull();
    expect(
      clampRegion({ ...base, x: 0, y: 0, width: Infinity, height: 300 }, 1400, 1900)
    ).toBeNull();
  });

  it("never lets a clamped box exceed the page bounds", () => {
    const r = clampRegion({ ...base, x: 1399, y: 1899, width: 999, height: 999 }, 1400, 1900);
    // x/y capped at pageDim-1, width/height cannot push past the edge
    if (r) {
      expect(r.x + r.width).toBeLessThanOrEqual(1400);
      expect(r.y + r.height).toBeLessThanOrEqual(1900);
    }
  });
});

describe("extractPptxText", () => {
  it("pulls text runs slide by slide in order", async () => {
    const zip = new JSZip();
    zip.file(
      "ppt/slides/slide2.xml",
      `<p:sld><a:t>두 번째 슬라이드</a:t><a:t>내용</a:t></p:sld>`
    );
    zip.file("ppt/slides/slide1.xml", `<p:sld><a:t>첫 슬라이드 제목</a:t></p:sld>`);
    zip.file("ppt/slides/slide10.xml", `<p:sld><a:t>열 번째</a:t></p:sld>`);
    const buffer = await zip.generateAsync({ type: "nodebuffer" });

    const text = await extractPptxText(buffer);
    expect(text).toContain("## Slide 1\n\n첫 슬라이드 제목");
    expect(text).toContain("## Slide 2\n\n두 번째 슬라이드 내용");
    // numeric ordering, not lexicographic (slide10 after slide2)
    expect(text.indexOf("## Slide 2")).toBeLessThan(text.indexOf("## Slide 10"));
  });
});
