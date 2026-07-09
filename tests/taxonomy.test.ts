import { describe, expect, it } from "vitest";
import {
  CATEGORY_TAXONOMY,
  getCategory,
  getCategoryPath,
  getChildCategories,
  getLeafCategories,
  getTopLevelCategories,
} from "../lib/codex/taxonomy";

describe("taxonomy", () => {
  it("every parentKey reference points at a real category", () => {
    for (const category of CATEGORY_TAXONOMY) {
      if (category.parentKey) {
        expect(() => getCategory(category.parentKey!)).not.toThrow();
      }
    }
  });

  it("has no duplicate keys", () => {
    const keys = CATEGORY_TAXONOMY.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("builds a full slash path from root to leaf", () => {
    expect(getCategoryPath("botox")).toBe("procedure-technique/botox");
    expect(getCategoryPath("rejuran")).toBe("procedure-technique/skin-booster/rejuran");
  });

  it("top-level categories have no parent", () => {
    for (const category of getTopLevelCategories()) {
      expect(category.parentKey).toBeUndefined();
    }
  });

  it("leaf categories have no children", () => {
    for (const category of getLeafCategories()) {
      expect(getChildCategories(category.key)).toHaveLength(0);
    }
  });
});
