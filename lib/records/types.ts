// lib/records/types.ts
// Longitudinal case records: patient → course → visit → photo. No names or
// contact details anywhere — a patient is a chart number and an alias.

export type ScoreKind = "none" | "mmasi" | "wsrs" | "vas";
export type VisitKind = "baseline" | "session" | "followup";
export type CourseStatus = "active" | "done" | "paused";
export type Angle = "front" | "left45" | "right45" | "left" | "right" | "close";

export const ANGLES: Angle[] = ["front", "left45", "right45", "left", "right", "close"];

export interface BiLabel {
  en: string;
  ko: string;
}

export const ANGLE_LABEL: Record<Angle, BiLabel> = {
  front: { en: "Front", ko: "정면" },
  left45: { en: "45° Left", ko: "좌 45°" },
  right45: { en: "45° Right", ko: "우 45°" },
  left: { en: "Left", ko: "좌측" },
  right: { en: "Right", ko: "우측" },
  close: { en: "Close-up", ko: "근접" },
};

export const VISIT_KIND_LABEL: Record<VisitKind, BiLabel> = {
  baseline: { en: "Baseline", ko: "시작 전" },
  session: { en: "Session", ko: "회차" },
  followup: { en: "Follow-up", ko: "F/U" },
};

export const STATUS_LABEL: Record<CourseStatus, BiLabel> = {
  active: { en: "Active", ko: "진행 중" },
  done: { en: "Done", ko: "완료" },
  paused: { en: "Paused", ko: "중단" },
};

export const SCORE_KINDS: Record<
  ScoreKind,
  BiLabel & { min: number; max: number; better: "lower" | "higher" | null }
> = {
  none: { en: "No score", ko: "점수 없음", min: 0, max: 0, better: null },
  mmasi: { en: "mMASI", ko: "기미 점수", min: 0, max: 24, better: "lower" },
  wsrs: { en: "WSRS", ko: "주름 점수", min: 1, max: 5, better: "lower" },
  vas: { en: "VAS", ko: "원장 판단 0–10", min: 0, max: 10, better: "higher" },
};

export const GAIS_LABEL: Record<1 | 2 | 3 | 4 | 5, BiLabel> = {
  1: { en: "Exceptional", ko: "매우 좋아짐" },
  2: { en: "Very much improved", ko: "많이 좋아짐" },
  3: { en: "Improved", ko: "좋아짐" },
  4: { en: "Unaltered", ko: "변화 없음" },
  5: { en: "Worse", ko: "악화" },
};

export interface Patient {
  id: string;
  chartNo: string;
  alias: string;
  /** "40대 여성 · 기미 · 와파린" — filled from consult chips, editable. */
  features: string;
  memo: string;
  createdAt: string;
  updatedAt: string;
}

export interface Course {
  id: string;
  patientId: string;
  procedure: string;
  indication: string;
  plannedSessions: number | null;
  scoreKind: ScoreKind;
  status: CourseStatus;
  /** YYYY-MM-DD */
  startedAt: string;
  createdAt: string;
}

export interface Visit {
  id: string;
  courseId: string;
  /** YYYY-MM-DD */
  date: string;
  kind: VisitKind;
  sessionNo: number | null;
  product: string;
  params: string;
  note: string;
  gaisDoctor: number | null;
  gaisPatient: number | null;
  score: number | null;
  nextFuDate: string | null;
  /** BBIP consult session this visit came from, if any. */
  sessionId: string | null;
  createdAt: string;
}

export interface Photo {
  id: string;
  visitId: string;
  angle: Angle;
  file: string;
  thumb: string;
  width: number;
  height: number;
  createdAt: string;
}

export interface VisitWithPhotos extends Visit {
  photos: Photo[];
}

export interface CourseRecord extends Course {
  visits: VisitWithPhotos[];
}

export interface PatientRecord {
  patient: Patient;
  courses: CourseRecord[];
}

export interface PatientSummary {
  patient: Patient;
  activeCourses: Array<{ id: string; procedure: string; done: number; planned: number | null }>;
  /** Every course's procedure, for search and matching. */
  procedures: string[];
  lastVisit: string | null;
  nextFu: string | null;
}

export interface PatientCandidate {
  patient: Patient;
  score: number;
  /** What matched, for the suggestion line: "40대 · 여성 · 기미 · 피코토닝". */
  reason: string;
}

export type FuStatus = "overdue" | "today" | "week" | "later";

export interface FollowUpItem {
  patient: Patient;
  courseId: string;
  procedure: string;
  date: string;
  status: FuStatus;
}
