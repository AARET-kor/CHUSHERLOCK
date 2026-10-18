// tests/bbip-flags.test.ts
import { describe, expect, it } from "vitest";
import { mergeFlags, ruleFlags } from "../lib/bbip/flags";
import type { ParsedCase } from "../lib/bbip/types";

function chips(overrides: Partial<ParsedCase> = {}): ParsedCase {
  return { patient: [], conditions: [], meds: [], procedures: [], ...overrides };
}

describe("ruleFlags", () => {
  it("flags anticoagulants as caution (case-insensitive)", () => {
    const flags = ruleFlags(chips({ meds: ["Aspirin"] }));
    expect(flags).toHaveLength(1);
    expect(flags[0]).toMatchObject({ level: "caution", source: "rule" });
    expect(flags[0]!.text).toContain("항응고");
  });

  it("flags isotretinoin brand names as contraindication", () => {
    const flags = ruleFlags(chips({ meds: ["로아큐탄"] }));
    expect(flags[0]).toMatchObject({ level: "contraindication" });
  });

  it("scans every chip group", () => {
    const flags = ruleFlags(chips({ patient: ["임신 12주"], conditions: ["켈로이드 체질"] }));
    expect(flags.map((f) => f.level)).toEqual(["contraindication", "caution"]);
  });

  it("also scans the raw memo text", () => {
    const flags = ruleFlags(chips(), "로아큐탄 먹는 중");
    expect(flags).toHaveLength(1);
    expect(flags[0]).toMatchObject({ level: "contraindication" });
  });

  it("returns nothing for a clean case", () => {
    expect(ruleFlags(chips({ patient: ["30대 남성"], procedures: ["보톡스"] }))).toEqual([]);
  });
});

describe("mergeFlags", () => {
  it("dedupes by text and puts contraindications and rule flags first", () => {
    const merged = mergeFlags(
      [{ level: "caution", text: "A", source: "rule" }],
      [
        { level: "caution", text: "A", source: "model" },
        { level: "contraindication", text: "B", source: "model" },
        { level: "caution", text: "C", source: "model" },
      ]
    );
    expect(merged.map((f) => f.text)).toEqual(["B", "A", "C"]);
    expect(merged[1]!.source).toBe("rule");
  });
});
