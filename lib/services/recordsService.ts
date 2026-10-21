// lib/services/recordsService.ts
import { randomUUID } from "node:crypto";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { procedureKey } from "../bbip/care/sets";
import { db } from "../db/client";
import { bbipSessions, courses, patients, photos, visits } from "../db/schema";
import { deletePhotoFiles } from "../records/files";
import { fuStatus } from "../records/schedule";
import {
  ANGLES,
  SCORE_KINDS,
  type Angle,
  type Course,
  type CourseRecord,
  type CourseStatus,
  type FollowUpItem,
  type Patient,
  type PatientRecord,
  type PatientSummary,
  type Photo,
  type ScoreKind,
  type Visit,
} from "../records/types";

// better-sqlite3 is synchronous; these functions are too.

export class ChartNoTakenError extends Error {
  constructor(public readonly patientId: string) {
    super("이미 등록된 차트번호입니다.");
    this.name = "ChartNoTakenError";
  }
}

export class RecordValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecordValidationError";
  }
}

type PatientRow = typeof patients.$inferSelect;
type CourseRow = typeof courses.$inferSelect;
type VisitRow = typeof visits.$inferSelect;
type PhotoRow = typeof photos.$inferSelect;

const nowIso = () => new Date().toISOString();

const toPatient = (row: PatientRow): Patient => ({ ...row });
const toCourse = (row: CourseRow): Course => ({ ...row });
const toVisit = (row: VisitRow): Visit => ({ ...row });
const toPhoto = (row: PhotoRow): Photo => ({ ...row });

// ── Patients ───────────────────────────────────────────────────────────────

export interface PatientInput {
  chartNo: string;
  alias: string;
  features: string;
  memo: string;
}

export function createPatient(input: PatientInput): Patient {
  const existing = getPatientByChartNo(input.chartNo);
  if (existing) throw new ChartNoTakenError(existing.id);
  const now = nowIso();
  const row: PatientRow = { id: randomUUID(), ...input, createdAt: now, updatedAt: now };
  db.insert(patients).values(row).run();
  return toPatient(row);
}

export function getPatient(id: string): Patient | null {
  const row = db.select().from(patients).where(eq(patients.id, id)).get();
  return row ? toPatient(row) : null;
}

export function getPatientByChartNo(chartNo: string): Patient | null {
  const row = db.select().from(patients).where(eq(patients.chartNo, chartNo)).get();
  return row ? toPatient(row) : null;
}

export function updatePatient(id: string, patch: Partial<PatientInput>): Patient | null {
  if (patch.chartNo) {
    const other = getPatientByChartNo(patch.chartNo);
    if (other && other.id !== id) throw new ChartNoTakenError(other.id);
  }
  const result = db.update(patients).set({ ...patch, updatedAt: nowIso() }).where(eq(patients.id, id)).run();
  return result.changes === 1 ? getPatient(id) : null;
}

function touchPatient(id: string): void {
  db.update(patients).set({ updatedAt: nowIso() }).where(eq(patients.id, id)).run();
}

/** Photo rows go with the cascade; their files are removed here. */
function removeFiles(rows: PhotoRow[]): void {
  for (const row of rows) deletePhotoFiles(row);
}

function photosOfVisits(visitIds: string[]): PhotoRow[] {
  return visitIds.length ? db.select().from(photos).where(inArray(photos.visitId, visitIds)).all() : [];
}

function visitIdsOfCourses(courseIds: string[]): string[] {
  return courseIds.length
    ? db.select({ id: visits.id }).from(visits).where(inArray(visits.courseId, courseIds)).all().map((r) => r.id)
    : [];
}

export function deletePatient(id: string): boolean {
  const courseIds = db.select({ id: courses.id }).from(courses).where(eq(courses.patientId, id)).all().map((r) => r.id);
  const files = photosOfVisits(visitIdsOfCourses(courseIds));
  const result = db.delete(patients).where(eq(patients.id, id)).run();
  if (result.changes === 1) removeFiles(files);
  return result.changes === 1;
}

// ── Courses ────────────────────────────────────────────────────────────────

export interface CourseInput {
  patientId: string;
  procedure: string;
  indication: string;
  plannedSessions: number | null;
  scoreKind: ScoreKind;
  startedAt: string;
}

export function createCourse(input: CourseInput): Course {
  if (!getPatient(input.patientId)) throw new RecordValidationError("환자를 찾을 수 없습니다.");
  const row: CourseRow = { id: randomUUID(), ...input, status: "active", createdAt: nowIso() };
  db.insert(courses).values(row).run();
  touchPatient(input.patientId);
  return toCourse(row);
}

export function getCourse(id: string): Course | null {
  const row = db.select().from(courses).where(eq(courses.id, id)).get();
  return row ? toCourse(row) : null;
}

export function updateCourse(
  id: string,
  patch: Partial<Omit<CourseInput, "patientId">> & { status?: CourseStatus }
): Course | null {
  const result = db.update(courses).set(patch).where(eq(courses.id, id)).run();
  return result.changes === 1 ? getCourse(id) : null;
}

export function deleteCourse(id: string): boolean {
  const files = photosOfVisits(visitIdsOfCourses([id]));
  const result = db.delete(courses).where(eq(courses.id, id)).run();
  if (result.changes === 1) removeFiles(files);
  return result.changes === 1;
}

// ── Visits ─────────────────────────────────────────────────────────────────

export type VisitInput = Omit<Visit, "id" | "createdAt" | "result" | "aiAnalysis"> & {
  result?: string;
  aiAnalysis?: Visit["aiAnalysis"];
};

function checkScore(course: Course, score: number | null): void {
  if (score === null) return;
  const kind = SCORE_KINDS[course.scoreKind];
  if (course.scoreKind === "none") throw new RecordValidationError("이 코스는 점수를 기록하지 않습니다.");
  if (score < kind.min || score > kind.max) {
    throw new RecordValidationError(`${kind.en} 점수는 ${kind.min}–${kind.max} 사이여야 합니다.`);
  }
}

export function createVisit(input: VisitInput): Visit {
  const course = getCourse(input.courseId);
  if (!course) throw new RecordValidationError("코스를 찾을 수 없습니다.");
  checkScore(course, input.score);
  const row: VisitRow = {
    id: randomUUID(),
    ...input,
    result: input.result ?? "",
    aiAnalysis: input.aiAnalysis ?? null,
    createdAt: nowIso(),
  };
  db.insert(visits).values(row).run();
  touchPatient(course.patientId);
  return toVisit(row);
}

export function getVisit(id: string): Visit | null {
  const row = db.select().from(visits).where(eq(visits.id, id)).get();
  return row ? toVisit(row) : null;
}

export function updateVisit(id: string, patch: Partial<Omit<VisitInput, "courseId">>): Visit | null {
  const visit = getVisit(id);
  if (!visit) return null;
  if (patch.score !== undefined) checkScore(getCourse(visit.courseId)!, patch.score);
  db.update(visits).set(patch).where(eq(visits.id, id)).run();
  return getVisit(id);
}

export function deleteVisit(id: string): boolean {
  const files = photosOfVisits([id]);
  const result = db.delete(visits).where(eq(visits.id, id)).run();
  if (result.changes === 1) removeFiles(files);
  return result.changes === 1;
}

export function visitForSession(sessionId: string): Visit | null {
  const row = db.select().from(visits).where(eq(visits.sessionId, sessionId)).orderBy(desc(visits.createdAt)).get();
  return row ? toVisit(row) : null;
}

// ── Photos ─────────────────────────────────────────────────────────────────

export function addPhoto(input: Omit<Photo, "id" | "createdAt">): Photo {
  const row: PhotoRow = { id: randomUUID(), ...input, createdAt: nowIso() };
  db.insert(photos).values(row).run();
  return toPhoto(row);
}

export function getPhoto(id: string): Photo | null {
  const row = db.select().from(photos).where(eq(photos.id, id)).get();
  return row ? toPhoto(row) : null;
}

export function setPhotoAngle(id: string, angle: Angle): Photo | null {
  const result = db.update(photos).set({ angle }).where(eq(photos.id, id)).run();
  return result.changes === 1 ? getPhoto(id) : null;
}

export function deletePhoto(id: string): boolean {
  const row = db.select().from(photos).where(eq(photos.id, id)).get();
  if (!row) return false;
  db.delete(photos).where(eq(photos.id, id)).run();
  removeFiles([row]);
  return true;
}

// ── Records and summaries ──────────────────────────────────────────────────

const angleRank = (angle: Angle) => ANGLES.indexOf(angle);

export function getPatientRecord(id: string): PatientRecord | null {
  const patient = getPatient(id);
  if (!patient) return null;
  const courseRows = db.select().from(courses).where(eq(courses.patientId, id)).orderBy(desc(courses.startedAt)).all();
  const visitRows = courseRows.length
    ? db
        .select()
        .from(visits)
        .where(inArray(visits.courseId, courseRows.map((c) => c.id)))
        .orderBy(asc(visits.date), asc(visits.createdAt))
        .all()
    : [];
  const photoRows = photosOfVisits(visitRows.map((v) => v.id));
  const courseRecords: CourseRecord[] = courseRows.map((course) => ({
    ...toCourse(course),
    visits: visitRows
      .filter((v) => v.courseId === course.id)
      .map((v) => ({
        ...toVisit(v),
        photos: photoRows
          .filter((p) => p.visitId === v.id)
          .map(toPhoto)
          .sort((a, b) => angleRank(a.angle) - angleRank(b.angle) || a.createdAt.localeCompare(b.createdAt)),
      })),
  }));
  courseRecords.sort((a, b) => Number(a.status !== "active") - Number(b.status !== "active"));
  return { patient, courses: courseRecords };
}

/** One row per patient, most recently seen first. Small data (one clinic),
 * so this loads everything and groups in memory. */
export function listPatientSummaries(): PatientSummary[] {
  const patientRows = db.select().from(patients).all();
  const courseRows = db.select().from(courses).all();
  const visitRows = db
    .select({ courseId: visits.courseId, date: visits.date, kind: visits.kind, nextFuDate: visits.nextFuDate, createdAt: visits.createdAt })
    .from(visits)
    .orderBy(asc(visits.date), asc(visits.createdAt))
    .all();
  const summaries = patientRows.map((row): PatientSummary => {
    const own = courseRows.filter((c) => c.patientId === row.id);
    const ownVisits = visitRows.filter((v) => own.some((c) => c.id === v.courseId));
    const active = own.filter((c) => c.status === "active");
    const nextFus = active
      .map((c) => ownVisits.filter((v) => v.courseId === c.id).at(-1)?.nextFuDate ?? null)
      .filter((d): d is string => d !== null)
      .sort();
    return {
      patient: toPatient(row),
      activeCourses: active.map((c) => ({
        id: c.id,
        procedure: c.procedure,
        done: ownVisits.filter((v) => v.courseId === c.id && v.kind === "session").length,
        planned: c.plannedSessions,
      })),
      procedures: own.map((c) => c.procedure),
      lastVisit: ownVisits.at(-1)?.date ?? null,
      nextFu: nextFus[0] ?? null,
    };
  });
  return summaries.sort((a, b) =>
    (b.lastVisit ?? b.patient.updatedAt).localeCompare(a.lastVisit ?? a.patient.updatedAt)
  );
}

export function patientSummary(id: string): PatientSummary | null {
  return listPatientSummaries().find((s) => s.patient.id === id) ?? null;
}

export function searchPatients(query: string, limit = 50): PatientSummary[] {
  const all = listPatientSummaries();
  const q = procedureKey(query);
  if (!q) return all.slice(0, limit);
  return all
    .filter((s) =>
      [s.patient.chartNo, s.patient.alias, s.patient.features, ...s.procedures].some((text) =>
        procedureKey(text).includes(q)
      )
    )
    .slice(0, limit);
}

/** Active courses whose latest visit asks for a F/U on or before a week from today. */
export function listFollowUps(today: string): FollowUpItem[] {
  const items: FollowUpItem[] = [];
  for (const summary of listPatientSummaries()) {
    const record = getPatientRecord(summary.patient.id)!;
    for (const course of record.courses) {
      if (course.status !== "active") continue;
      const date = course.visits.at(-1)?.nextFuDate;
      if (!date) continue;
      const status = fuStatus(date, today);
      if (status !== "later") items.push({ patient: summary.patient, courseId: course.id, procedure: course.procedure, date, status });
    }
  }
  return items.sort((a, b) => a.date.localeCompare(b.date));
}

// ── Consult link ───────────────────────────────────────────────────────────

export function linkSessionPatient(sessionId: string, patientId: string | null): boolean {
  const result = db.update(bbipSessions).set({ patientId }).where(eq(bbipSessions.id, sessionId)).run();
  return result.changes === 1;
}
