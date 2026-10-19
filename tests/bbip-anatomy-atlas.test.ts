// tests/bbip-anatomy-atlas.test.ts
import { describe, expect, it } from "vitest";
import { ATLAS, ATLAS_BY_ID, ATLAS_VIEWBOX, isReviewed } from "../lib/bbip/anatomy/atlas";
import { DEPTHS, LAYERS, PROCEDURE_CATEGORIES, RISKS } from "../lib/bbip/anatomy/layers";
import { REGIONS } from "../lib/bbip/anatomy/regions";

const depthKeys = new Set(DEPTHS.map((d) => d.key));
const layerKeys = new Set(LAYERS.map((l) => l.key));

function allPoints(s: (typeof ATLAS)[number]) {
  return (s.shapes.front ?? []).flatMap((shape) =>
    shape.kind === "point" ? [shape.at] : shape.kind === "vector" ? [shape.from, shape.to] : shape.pts
  );
}

describe("anatomy atlas integrity", () => {
  it("has unique kebab-case ids", () => {
    expect(new Set(ATLAS.map((s) => s.id)).size).toBe(ATLAS.length);
    for (const s of ATLAS) expect(s.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("gives every structure a depth, a risk, a layer and its texts", () => {
    for (const s of ATLAS) {
      expect(s.depths.length, s.id).toBeGreaterThan(0);
      for (const d of s.depths) expect(depthKeys.has(d), `${s.id} ${d}`).toBe(true);
      expect(Object.keys(RISKS)).toContain(s.risk);
      expect(layerKeys.has(s.layer), s.id).toBe(true);
      for (const text of [s.ko, s.en, s.course, s.riskNote, s.safeTechnique, s.depthNote, s.source]) {
        expect(text.trim().length, s.id).toBeGreaterThan(0);
      }
    }
  });

  it("draws every structure in the front view inside the viewBox", () => {
    for (const s of ATLAS) {
      const pts = allPoints(s);
      expect(pts.length, s.id).toBeGreaterThan(0);
      for (const [x, y] of pts) {
        expect(x >= 0 && x <= ATLAS_VIEWBOX.width && y >= 0 && y <= ATLAS_VIEWBOX.height, s.id).toBe(true);
      }
    }
  });

  it("limits entry points to known procedure categories", () => {
    for (const s of ATLAS.filter((x) => x.layer === "entry")) {
      expect(s.entryFor?.length, s.id).toBeGreaterThan(0);
      for (const c of s.entryFor ?? []) expect(PROCEDURE_CATEGORIES).toContain(c);
    }
  });

  it("ships as an unreviewed draft until the doctor signs off", () => {
    for (const s of ATLAS) {
      expect(isReviewed(s)).toBe(Boolean(s.reviewedBy && s.reviewedAt));
    }
  });
});

describe("regions", () => {
  it("covers the eight v1 regions", () => {
    expect(REGIONS.map((r) => r.key)).toEqual([
      "forehead-glabella", "temple", "nose", "tear-trough", "midface", "nasolabial", "lips", "chin-jawline",
    ]);
  });

  it("references only existing atlas ids", () => {
    for (const r of REGIONS) {
      expect(r.structureIds.length, r.key).toBeGreaterThan(0);
      for (const id of r.structureIds) expect(ATLAS_BY_ID.has(id), `${r.key} → ${id}`).toBe(true);
    }
  });

  it("puts every non-entry structure in at least one region", () => {
    const used = new Set(REGIONS.flatMap((r) => r.structureIds));
    for (const s of ATLAS) expect(used.has(s.id), s.id).toBe(true);
  });

  it("defines a plane for every procedure category with valid depths", () => {
    for (const r of REGIONS) {
      for (const c of PROCEDURE_CATEGORIES) {
        const plane = r.planes[c];
        expect(plane, `${r.key} ${c}`).toBeDefined();
        for (const d of plane.depths) expect(depthKeys.has(d)).toBe(true);
        expect(plane.note.length).toBeGreaterThan(0);
      }
    }
  });
});
