// tests/bbip-anatomy-functions.test.ts
import { describe, expect, it } from "vitest";
import { ATLAS, ATLAS_BY_ID } from "../lib/bbip/anatomy/atlas";
import { FUNCTION_LAYERS, STRUCTURE_FUNCTIONS, TERRITORY_LABEL } from "../lib/bbip/anatomy/functions";

describe("structure territory and role", () => {
  it("covers every vessel, nerve, muscle and duct of the atlas", () => {
    const missing = ATLAS.filter((s) => FUNCTION_LAYERS.includes(s.layer) && !STRUCTURE_FUNCTIONS[s.id]).map((s) => s.id);
    expect(missing).toEqual([]);
  });

  it("only describes atlas structures of those layers, with both fields written", () => {
    for (const [id, fn] of Object.entries(STRUCTURE_FUNCTIONS)) {
      const structure = ATLAS_BY_ID.get(id);
      expect(structure, id).toBeDefined();
      expect(FUNCTION_LAYERS).toContain(structure!.layer);
      expect(fn.territory.trim().length, id).toBeGreaterThan(1);
      expect(fn.role.trim().length, id).toBeGreaterThan(10);
    }
  });

  it("labels the territory for every described layer", () => {
    for (const layer of FUNCTION_LAYERS) expect(TERRITORY_LABEL[layer]).toBeDefined();
  });
});
