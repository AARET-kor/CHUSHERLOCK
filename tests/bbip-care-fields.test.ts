// tests/bbip-care-fields.test.ts
import { describe, expect, it } from "vitest";
import {
  ALL_FIELD_KEYS,
  CARE_FIELDS,
  CARE_KINDS,
  emptyFields,
  newCareItem,
  pickFields,
  PRIMARY_FIELD,
} from "../lib/bbip/care/fields";

describe("care fields", () => {
  it("defines fields per kind with a required primary field", () => {
    for (const kind of CARE_KINDS) {
      const primary = CARE_FIELDS[kind].find((f) => f.key === PRIMARY_FIELD[kind]);
      expect(primary?.required).toBe(true);
    }
    expect(CARE_FIELDS.rx.filter((f) => f.required).map((f) => f.key)).toEqual([
      "drug",
      "form",
      "dose",
      "frequency",
      "duration",
    ]);
    expect(CARE_FIELDS.contingency.find((f) => f.key === "urgency")?.options?.map((o) => o.value)).toEqual([
      "now",
      "followup",
      "watch",
    ]);
  });

  it("lists every flat field key once", () => {
    expect(new Set(ALL_FIELD_KEYS).size).toBe(ALL_FIELD_KEYS.length);
    expect(ALL_FIELD_KEYS).toEqual(
      expect.arrayContaining(["drug", "material", "situation", "urgency", "day", "when", "duration"])
    );
  });

  it("picks only the kind's own fields as trimmed strings", () => {
    expect(pickFields("dressing", { material: "  재생크림 ", drug: "x", interval: 3 })).toEqual({
      material: "재생크림",
      method: "",
      interval: "",
      duration: "",
    });
    expect(emptyFields("followup")).toEqual({ day: "", when: "", checks: "", next: "" });
  });

  it("creates blank doctor rows", () => {
    const item = newCareItem("rx");
    expect(item).toMatchObject({ kind: "rx", source: "doctor", confirmed: false, patientText: "" });
    expect(item.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(item.fields).toEqual(emptyFields("rx"));
  });
});
