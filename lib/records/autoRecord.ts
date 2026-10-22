// lib/records/autoRecord.ts
import { toPlainNoteText } from "../bbip/evidence";
import { getSession, listTurns } from "../services/bbipService";
import { getCareOrder } from "../services/careService";
import {
  createCourse,
  createVisit,
  getPatientRecord,
  updateVisit,
  visitForSession,
} from "../services/recordsService";
import { suggestCourse, visitDefaults } from "./defaults";
import { nextFuFromCare, todayIso } from "./schedule";
import type { Visit } from "./types";

// A consult linked to a records patient is saved to that patient's record
// on its own: pressing BBIP makes today's visit (next session of the matching
// course, or a new course), and the key brief becomes the visit's result.

const RESULT_MAX = 1500;

/** The brief as plain result text: markers spelled out, follow-ups dropped. */
export function briefResult(output: string): string {
  const text = toPlainNoteText(output.replace(/<followups>[\s\S]*?(<\/followups>|$)/g, "")).trim();
  return text.length <= RESULT_MAX ? text : `${text.slice(0, RESULT_MAX)}…`;
}

function latestBriefResult(sessionId: string): string {
  const brief = listTurns(sessionId)
    .filter((t) => t.kind === "brief" && t.status === "done")
    .at(-1);
  return brief ? briefResult(brief.output) : "";
}

/** The consult's visit in the linked patient's record, created on first
 * call. Null when the consult has no patient or no procedure chip. */
export function ensureSessionVisit(sessionId: string, today = todayIso()): Visit | null {
  const session = getSession(sessionId);
  if (!session?.patientId) return null;
  const existing = visitForSession(sessionId);
  if (existing) return existing;
  const procedure = session.chips.procedures[0];
  if (!procedure) return null;
  const record = getPatientRecord(session.patientId);
  if (!record) return null;
  const suggested = suggestCourse(record.courses, session.chips.procedures);
  const courseId =
    suggested?.id ??
    createCourse({
      patientId: record.patient.id,
      procedure,
      indication: session.chips.conditions[0] ?? "",
      plannedSessions: null,
      scoreKind: "none",
      startedAt: today,
    }).id;
  const care = getCareOrder(sessionId);
  const defaults = visitDefaults({
    course: suggested,
    today,
    careNextFu: care ? nextFuFromCare(care.items, today) : null,
  });
  return createVisit({
    courseId,
    ...defaults,
    note: "",
    gaisDoctor: null,
    gaisPatient: null,
    score: null,
    sessionId,
    result: latestBriefResult(sessionId),
  });
}

/** Called when a brief finishes: its text becomes the visit's result. */
export function recordBriefResult(sessionId: string, output: string): void {
  const visit = visitForSession(sessionId);
  if (visit) updateVisit(visit.id, { result: briefResult(output) });
}

/** Unlink the consult while preserving the visit, annotations and photos. */
export function removeSessionVisit(sessionId: string): void {
  const visit = visitForSession(sessionId);
  if (visit) updateVisit(visit.id, { sessionId: null });
}
