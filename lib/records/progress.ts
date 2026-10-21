// lib/records/progress.ts
// Course progress for the chart and the photo comparison. Pure — used on
// the course page (client) and in tests.
import { ANGLES, type Angle, type Visit, type VisitWithPhotos } from "./types";

export function visitLabel(visit: Pick<Visit, "kind" | "sessionNo">): string {
  if (visit.kind === "baseline") return "Baseline";
  if (visit.kind === "followup") return "F/U";
  return visit.sessionNo ? `S${visit.sessionNo}` : "Session";
}

export interface ProgressRow {
  visitId: string;
  label: string;
  date: string;
  gaisDoctor: number | null;
  gaisPatient: number | null;
  score: number | null;
}

/** One row per visit that carries at least one value, in visit order. */
export function progressRows(visits: Visit[]): ProgressRow[] {
  return visits
    .filter((v) => v.gaisDoctor !== null || v.gaisPatient !== null || v.score !== null)
    .map((v) => ({
      visitId: v.id,
      label: visitLabel(v),
      date: v.date,
      gaisDoctor: v.gaisDoctor,
      gaisPatient: v.gaisPatient,
      score: v.score,
    }));
}

/** Angles both visits have photos for, in the standard order. */
export function sharedAngles(a: VisitWithPhotos, b: VisitWithPhotos): Angle[] {
  return ANGLES.filter((angle) => a.photos.some((p) => p.angle === angle) && b.photos.some((p) => p.angle === angle));
}

/** Default comparison: first vs last visit with photos, on their first shared angle. */
export function comparePair(visits: VisitWithPhotos[]): { fromId: string; toId: string; angle: Angle | null } | null {
  const withPhotos = visits.filter((v) => v.photos.length > 0);
  if (withPhotos.length < 2) return null;
  const from = withPhotos[0]!;
  const to = withPhotos.at(-1)!;
  return { fromId: from.id, toId: to.id, angle: sharedAngles(from, to)[0] ?? null };
}
