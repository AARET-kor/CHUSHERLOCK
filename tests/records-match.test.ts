// tests/records-match.test.ts
import { describe, expect, it } from "vitest";
import { matchPatients } from "../lib/records/match";
import type { PatientSummary } from "../lib/records/types";

const summary = (id: string, features: string, procedures: string[], lastVisit: string | null): PatientSummary => ({
  patient: { id, chartNo: id, alias: "", features, memo: "", createdAt: "", updatedAt: "" },
  activeCourses: [],
  procedures,
  courses: [],
  lastVisit,
  nextFu: null,
});

const chips = { patient: ["40대 여성"], conditions: ["기미"], meds: [], procedures: ["피코토닝 11회차"] };

describe("matchPatients", () => {
  it("ranks shared features and procedure, with a recency bonus", () => {
    const result = matchPatients(
      chips,
      [
        summary("A", "40대 여성 · 기미", ["피코토닝"], "2026-10-01"),
        summary("B", "40대 여성 · 기미", ["피코토닝"], "2025-01-01"),
        summary("C", "20대 남성 · 여드름", ["레이저"], "2026-10-01"),
        summary("D", "40대 여성", [], null),
      ],
      "2026-10-21"
    );
    expect(result.map((c) => c.patient.id)).toEqual(["A", "B", "D"]);
    expect(result[0]!.reason).toBe("40대 · 여성 · 기미 · 피코토닝");
  });

  it("needs a score of 4 and caps the list", () => {
    expect(matchPatients(chips, [summary("E", "여성", [], null)], "2026-10-21")).toEqual([]);
    const many = Array.from({ length: 6 }, (_, i) => summary(`P${i}`, "40대 여성 · 기미", ["피코토닝"], null));
    expect(matchPatients(chips, many, "2026-10-21")).toHaveLength(3);
  });
});
