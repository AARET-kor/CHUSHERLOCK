// tests/records-progress.test.ts
import { describe, expect, it } from "vitest";
import { comparePair, progressRows, sharedAngles, visitLabel } from "../lib/records/progress";
import type { Angle, VisitWithPhotos } from "../lib/records/types";

const photo = (visitId: string, angle: Angle) => ({
  id: `${visitId}-${angle}`, visitId, angle, file: "f.jpg", thumb: "t.jpg", width: 1, height: 1, createdAt: "",
});
const visit = (id: string, over: Partial<VisitWithPhotos> = {}): VisitWithPhotos => ({
  id, courseId: "c", date: "2026-10-01", kind: "session", sessionNo: null, product: "", params: "", note: "",
  gaisDoctor: null, gaisPatient: null, score: null, nextFuDate: null, result: "", sessionId: null, createdAt: "",
  aiAnalysis: null, photos: [], ...over,
});

describe("visitLabel", () => {
  it("names baseline, sessions and follow-ups", () => {
    expect(visitLabel(visit("a", { kind: "baseline" }))).toBe("Baseline");
    expect(visitLabel(visit("b", { sessionNo: 5 }))).toBe("S5");
    expect(visitLabel(visit("c", { kind: "followup" }))).toBe("F/U");
    expect(visitLabel(visit("d", { sessionNo: null }))).toBe("Session");
  });
});

describe("progressRows", () => {
  it("keeps visits with any value, in order", () => {
    const rows = progressRows([
      visit("a", { kind: "baseline", score: 18 }),
      visit("b", { sessionNo: 1 }),
      visit("c", { sessionNo: 5, gaisDoctor: 3, gaisPatient: 2, score: 11 }),
    ]);
    expect(rows).toEqual([
      { visitId: "a", label: "Baseline", date: "2026-10-01", gaisDoctor: null, gaisPatient: null, score: 18 },
      { visitId: "c", label: "S5", date: "2026-10-01", gaisDoctor: 3, gaisPatient: 2, score: 11 },
    ]);
  });
});

describe("compare", () => {
  const visits = [
    visit("a", { kind: "baseline", photos: [photo("a", "front"), photo("a", "left45")] }),
    visit("b", { sessionNo: 1 }),
    visit("c", { sessionNo: 5, photos: [photo("c", "left45"), photo("c", "front")] }),
  ];

  it("pairs the first and last visits with photos on a shared angle", () => {
    expect(comparePair(visits)).toEqual({ fromId: "a", toId: "c", angle: "front" });
    expect(comparePair([visits[0]!])).toBeNull();
    expect(comparePair([visits[0]!, visit("x", { photos: [photo("x", "close")] })])).toEqual({ fromId: "a", toId: "x", angle: null });
  });

  it("lists angles both visits have, in the standard order", () => {
    expect(sharedAngles(visits[0]!, visits[2]!)).toEqual(["front", "left45"]);
    expect(sharedAngles(visits[0]!, visits[1]!)).toEqual([]);
  });
});
