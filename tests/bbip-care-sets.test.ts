// tests/bbip-care-sets.test.ts
import { describe, expect, it } from "vitest";
import { conflictingPrimaries, dedupeKey, procedureKey, seedFromSets, toSetItems } from "../lib/bbip/care/sets";
import type { CareItem, CareSet } from "../lib/bbip/care/types";

const rxFields = { drug: "mupirocin", brand: "", form: "2% 연고", dose: "얇게", frequency: "1일 3회", duration: "5일", purpose: "" };
const item = (over: Partial<CareItem> = {}): CareItem => ({
  id: "i",
  kind: "rx",
  fields: { ...rxFields },
  patientText: "바르세요.",
  source: "set",
  confirmed: true,
  ...over,
});
const set = (id: string, items: CareItem[]): CareSet => ({ id, procedureKey: id, label: id, items, updatedAt: "" });

describe("care sets", () => {
  it("normalizes procedure keys", () => {
    expect(procedureKey(" 피코 토닝 ")).toBe("피코토닝");
    expect(procedureKey("ＰＩＣＯ Toning")).toBe("picotoning");
  });

  it("dedupes by kind and primary field", () => {
    expect(dedupeKey(item({ fields: { ...rxFields, drug: " MUPIROCIN" } }))).toBe(dedupeKey(item()));
    expect(dedupeKey(item({ kind: "dressing", fields: { material: "mupirocin" } }))).not.toBe(dedupeKey(item()));
  });

  it("seeds unconfirmed set rows with fresh ids, the first set winning on duplicates", () => {
    const seed = seedFromSets([
      set("a", [
        item({ id: "1" }),
        item({ id: "2", kind: "dressing", fields: { material: "재생크림", method: "얇게", interval: "", duration: "" } }),
      ]),
      set("b", [
        item({ id: "3", fields: { ...rxFields, drug: "Mupirocin " } }),
        item({ id: "4", kind: "followup", fields: { day: "7", when: "D+7", checks: "홍반", next: "" } }),
      ]),
    ]);
    expect(seed.map((row) => [row.kind, row.source, row.confirmed])).toEqual([
      ["rx", "set", false],
      ["dressing", "set", false],
      ["followup", "set", false],
    ]);
    expect(seed.map((row) => row.id)).not.toContain("1");
    expect(new Set(seed.map((row) => row.id)).size).toBe(3);
  });

  it("keeps the same drug in another form or dose as its own row", () => {
    const seed = seedFromSets([
      set("a", [item({ id: "1" })]),
      set("b", [item({ id: "2", fields: { ...rxFields, form: "2% 크림" } })]),
    ]);
    expect(seed.map((row) => row.fields.form)).toEqual(["2% 연고", "2% 크림"]);
    expect(conflictingPrimaries(seed)).toEqual(["mupirocin"]);
    expect(conflictingPrimaries([item(), item({ id: "z", removed: { reason: "x" }, fields: { ...rxFields, dose: "두껍게" } })])).toEqual([]);
  });

  it("turns confirmed active rows into set rows without citations", () => {
    const rows = toSetItems([
      item({ source: "note", cite: "2" }),
      item({ id: "x", confirmed: false }),
      item({ id: "y", removed: { reason: "임신" } }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ source: "set", confirmed: false, patientText: "바르세요." });
    expect(rows[0]).not.toHaveProperty("cite");
    expect(rows[0]).not.toHaveProperty("removed");
  });
});
