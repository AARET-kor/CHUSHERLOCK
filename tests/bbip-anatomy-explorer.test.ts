import { describe, expect, it } from "vitest";
import { ATLAS, getStructure } from "../lib/bbip/anatomy/atlas";
import { inDepth, regionViewBox, searchStructures, sharedDepthStructures } from "../lib/bbip/anatomy/explorer";
import { areaFor } from "../lib/bbip/anatomy/geometry";
import { VIEWS } from "../lib/bbip/anatomy/layers";
import { REGIONS } from "../lib/bbip/anatomy/regions";

describe("anatomy explorer", () => {
  it("finds Korean names, English names and authored aliases", () => {
    expect(searchStructures(ATLAS, "각동맥").map((s) => s.id)).toContain("angular-artery");
    expect(searchStructures(ATLAS, "  MASSETER ").map((s) => s.id)).toEqual(["masseter"]);
    expect(searchStructures(ATLAS, "Pitanguy").map((s) => s.id)).toEqual(["facial-nerve-temporal"]);
    expect(searchStructures(ATLAS, "angular artery").map((s) => s.id)).toEqual(["angular-artery"]);
    expect(searchStructures(ATLAS, "없는 구조")).toEqual([]);
  });

  it("filters by authored depths and restores all structures when cleared", () => {
    const structure = getStructure("angular-artery")!;
    expect(inDepth(structure, "subcutaneous")).toBe(true);
    expect(inDepth(structure, "periosteum")).toBe(false);
    expect(inDepth(structure, null)).toBe(true);
  });

  it("compares shared layers within supplied region without including itself or entry points", () => {
    const selected = getStructure("angular-artery")!;
    const related = sharedDepthStructures(selected, ATLAS);
    expect(related.some((s) => s.id === "facial-artery")).toBe(true);
    expect(related.every((s) => s.id !== selected.id && s.layer !== "entry")).toBe(true);
    expect(related.every((s) => s.depths.some((d) => selected.depths.includes(d)))).toBe(true);
    expect(sharedDepthStructures(selected, [selected])).toEqual([]);
  });

  it("fits every projected region in a bounded viewport with a stable aspect ratio", () => {
    for (const region of REGIONS) {
      for (const view of VIEWS) {
        const [x, y, w, h] = regionViewBox(areaFor(region.area, view.key)).split(" ").map(Number) as [number, number, number, number];
        expect(x).toBeGreaterThanOrEqual(0);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(x + w).toBeLessThanOrEqual(240.1);
        expect(y + h).toBeLessThanOrEqual(300.1);
        expect(w / h).toBeCloseTo(0.8, 2);
        expect(w).toBeGreaterThanOrEqual(80);
      }
    }
    expect(regionViewBox([])).toBe("0 0 240 300");
  });
});
