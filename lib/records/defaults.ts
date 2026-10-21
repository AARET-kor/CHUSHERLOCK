// lib/records/defaults.ts
import { procedureKey } from "../bbip/care/sets";
import { nextSessionNo } from "./schedule";
import type { CourseRecord, VisitKind } from "./types";

/** The active course matching one of the case's procedure chips. */
export function suggestCourse(courses: CourseRecord[], procedures: string[]): CourseRecord | null {
  const keys = procedures.map(procedureKey).filter(Boolean);
  return (
    courses.find((c) => {
      if (c.status !== "active") return false;
      const key = procedureKey(c.procedure);
      return keys.some((k) => k.includes(key) || key.includes(k));
    }) ?? null
  );
}

export interface VisitDefaults {
  date: string;
  kind: VisitKind;
  sessionNo: number | null;
  product: string;
  params: string;
  nextFuDate: string | null;
}

/** Prefill for the next visit: continue the course (next session number,
 * last product and parameters) or start one with a baseline. */
export function visitDefaults(args: { course: CourseRecord | null; today: string; careNextFu: string | null }): VisitDefaults {
  const { course } = args;
  if (!course || course.visits.length === 0) {
    return { date: args.today, kind: "baseline", sessionNo: null, product: "", params: "", nextFuDate: args.careNextFu };
  }
  const last = [...course.visits].reverse().find((v) => v.product || v.params);
  return {
    date: args.today,
    kind: "session",
    sessionNo: nextSessionNo(course.visits),
    product: last?.product ?? "",
    params: last?.params ?? "",
    nextFuDate: args.careNextFu,
  };
}
