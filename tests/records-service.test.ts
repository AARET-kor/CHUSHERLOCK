// tests/records-service.test.ts
import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setupTempDb } from "./helpers/tempDb";

let env: Awaited<ReturnType<typeof setupTempDb>>;
let records: typeof import("../lib/services/recordsService");
let bbip: typeof import("../lib/services/bbipService");
let files: typeof import("../lib/records/files");

beforeAll(async () => {
  env = await setupTempDb("records-service");
  records = await import("../lib/services/recordsService");
  bbip = await import("../lib/services/bbipService");
  files = await import("../lib/records/files");
});
afterAll(() => env.cleanup());

const visitInput = (courseId: string, over: Record<string, unknown> = {}) => ({
  courseId,
  date: "2026-10-01",
  kind: "session" as const,
  sessionNo: 1,
  product: "",
  params: "",
  note: "",
  gaisDoctor: null,
  gaisPatient: null,
  score: null,
  nextFuDate: null,
  sessionId: null,
  ...over,
});

describe("recordsService", () => {
  it("creates patients with unique chart numbers", () => {
    const p = records.createPatient({ chartNo: "20431", alias: "KJ", features: "40대 여성", memo: "" });
    expect(records.getPatientByChartNo("20431")?.id).toBe(p.id);
    expect(() => records.createPatient({ chartNo: "20431", alias: "", features: "", memo: "" })).toThrow(
      records.ChartNoTakenError
    );
    const updated = records.updatePatient(p.id, { alias: "KJ-40여 기미" });
    expect(updated?.alias).toBe("KJ-40여 기미");
  });

  it("builds a record with ordered visits and validates scores", () => {
    const p = records.createPatient({ chartNo: "R-1", alias: "", features: "", memo: "" });
    const c = records.createCourse({ patientId: p.id, procedure: "피코토닝", indication: "기미", plannedSessions: 20, scoreKind: "mmasi", startedAt: "2026-09-01" });
    records.createVisit(visitInput(c.id, { date: "2026-09-15", sessionNo: 2, score: 12 }));
    records.createVisit(visitInput(c.id, { date: "2026-09-01", kind: "baseline", sessionNo: null, score: 18 }));
    expect(() => records.createVisit(visitInput(c.id, { score: 30 }))).toThrow(records.RecordValidationError);
    const record = records.getPatientRecord(p.id)!;
    expect(record.courses[0]!.visits.map((v) => v.date)).toEqual(["2026-09-01", "2026-09-15"]);
    const none = records.createCourse({ patientId: p.id, procedure: "필러", indication: "", plannedSessions: null, scoreKind: "none", startedAt: "2026-10-01" });
    expect(() => records.createVisit(visitInput(none.id, { score: 3 }))).toThrow(records.RecordValidationError);
  });

  it("summarizes, searches and lists follow-ups", () => {
    const p = records.createPatient({ chartNo: "S-9", alias: "강남 토닝", features: "30대 여성 · 기미", memo: "" });
    const c = records.createCourse({ patientId: p.id, procedure: "레이저토닝", indication: "", plannedSessions: 10, scoreKind: "none", startedAt: "2026-10-01" });
    records.createVisit(visitInput(c.id, { date: "2026-10-01", sessionNo: 1, nextFuDate: "2026-10-20" }));
    records.createVisit(visitInput(c.id, { date: "2026-10-10", sessionNo: 2, nextFuDate: "2026-10-24" }));
    const summary = records.listPatientSummaries().find((s) => s.patient.id === p.id)!;
    expect(summary.activeCourses).toEqual([{ id: c.id, procedure: "레이저토닝", done: 2, planned: 10 }]);
    expect(summary.lastVisit).toBe("2026-10-10");
    expect(summary.nextFu).toBe("2026-10-24");
    expect(records.searchPatients("강남").map((s) => s.patient.id)).toEqual([p.id]);
    expect(records.searchPatients("레이저 토닝").map((s) => s.patient.id)).toEqual([p.id]);
    const fus = records.listFollowUps("2026-10-21");
    expect(fus.find((f) => f.patient.id === p.id)).toMatchObject({ date: "2026-10-24", status: "week" });
  });

  it("links sessions and finds the session's visit", () => {
    const p = records.createPatient({ chartNo: "L-77", alias: "", features: "", memo: "" });
    const session = bbip.createSession({ chips: { patient: [], conditions: [], meds: [], procedures: ["필러"] }, flags: [], sourceNoteIds: [] });
    records.linkSessionPatient(session.id, p.id);
    expect(bbip.getSession(session.id)?.patientId).toBe(p.id);
    const c = records.createCourse({ patientId: p.id, procedure: "필러", indication: "", plannedSessions: null, scoreKind: "none", startedAt: "2026-10-21" });
    const v = records.createVisit(visitInput(c.id, { sessionId: session.id }));
    expect(records.visitForSession(session.id)?.id).toBe(v.id);
    records.linkSessionPatient(session.id, null);
    expect(bbip.getSession(session.id)?.patientId).toBeUndefined();
  });

  it("deletes photo files with their patient and unlinks its consults", () => {
    const p = records.createPatient({ chartNo: "D-1", alias: "", features: "", memo: "" });
    const session = bbip.createSession({ chips: { patient: [], conditions: [], meds: [], procedures: ["필러"] }, flags: [], sourceNoteIds: [], patientId: p.id });
    const c = records.createCourse({ patientId: p.id, procedure: "필러", indication: "", plannedSessions: null, scoreKind: "none", startedAt: "2026-10-21" });
    const v = records.createVisit(visitInput(c.id));
    fs.mkdirSync(files.PHOTOS_DIR, { recursive: true });
    fs.writeFileSync(path.join(files.PHOTOS_DIR, "a.jpg"), "x");
    fs.writeFileSync(path.join(files.PHOTOS_DIR, "a_t.jpg"), "x");
    records.addPhoto({ visitId: v.id, angle: "front", file: "a.jpg", thumb: "a_t.jpg", width: 10, height: 10 });
    expect(records.deletePatient(p.id)).toBe(true);
    expect(fs.existsSync(path.join(files.PHOTOS_DIR, "a.jpg"))).toBe(false);
    expect(records.getPatient(p.id)).toBeNull();
    expect(bbip.getSession(session.id)?.patientId).toBeUndefined();
  });
});
