// tests/records-defaults.test.ts
import { describe, expect, it } from "vitest";
import { suggestCourse, visitDefaults } from "../lib/records/defaults";
import type { CourseRecord } from "../lib/records/types";

const course = (id: string, procedure: string, visits: Array<Partial<CourseRecord["visits"][number]>>, status = "active"): CourseRecord => ({
  id, patientId: "p", procedure, indication: "", plannedSessions: 20, scoreKind: "mmasi", status: status as "active", startedAt: "2026-09-01", createdAt: "",
  visits: visits.map((v, i) => ({
    id: `${id}-${i}`, courseId: id, date: "2026-09-01", kind: "session", sessionNo: i + 1, product: "", params: "", note: "",
    gaisDoctor: null, gaisPatient: null, score: null, nextFuDate: null, sessionId: null, createdAt: "", photos: [], ...v,
  })),
});

describe("suggestCourse", () => {
  it("picks the active course with the same procedure", () => {
    const courses = [course("a", "필러", []), course("b", "피코토닝", []), course("c", "피코토닝", [], "done")];
    expect(suggestCourse(courses, ["피코토닝 11회차"])?.id).toBe("b");
    expect(suggestCourse(courses, ["보톡스"])).toBeNull();
  });
});

describe("visitDefaults", () => {
  it("continues the course: next session, last product and params, F/U from the care order", () => {
    const c = course("b", "피코토닝", [{ sessionNo: 9 }, { sessionNo: 10, product: "PicoSure", params: "3.0J" }]);
    const d = visitDefaults({ course: c, today: "2026-10-21", careNextFu: "2026-10-28" });
    expect(d).toEqual({ date: "2026-10-21", kind: "session", sessionNo: 11, product: "PicoSure", params: "3.0J", nextFuDate: "2026-10-28" });
  });

  it("starts a new course with a baseline", () => {
    expect(visitDefaults({ course: null, today: "2026-10-21", careNextFu: null })).toEqual({
      date: "2026-10-21", kind: "baseline", sessionNo: null, product: "", params: "", nextFuDate: null,
    });
  });
});
