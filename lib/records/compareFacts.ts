// lib/records/compareFacts.ts
// What the AI change analysis is told about a course, besides the two
// photos. Clinical facts only — never the chart number, alias, features,
// memo, visit notes or consult results. Pure, so the confirm panel can show
// the doctor exactly this text before anything is sent.
import { visitLabel } from "./progress";
import { ANGLE_LABEL, SCORE_KINDS, type Angle, type CourseRecord, type Visit } from "./types";

function visitLine(v: Visit): string {
  const setup = [v.product, v.params].map((s) => s.trim()).filter(Boolean).join(" ");
  return `${v.date} ${visitLabel(v)}${setup ? ` · ${setup}` : ""}`;
}

export function compareFacts(course: CourseRecord, fromId: string, toId: string, angle: Angle): string {
  const from = course.visits.find((v) => v.id === fromId);
  const to = course.visits.find((v) => v.id === toId);
  if (!from || !to) return "";
  const i = course.visits.indexOf(from);
  const j = course.visits.indexOf(to);
  const between = course.visits.slice(Math.min(i, j) + 1, Math.max(i, j)).filter((v) => v.kind === "session").length;
  const kind = SCORE_KINDS[course.scoreKind];
  const lines = [
    `시술: ${[course.procedure, course.indication].filter(Boolean).join(" · ")}`,
    `이전: ${visitLine(from)}`,
    `이후: ${visitLine(to)}`,
    `사이 회차: ${between}`,
    `각도: ${ANGLE_LABEL[angle].ko}`,
  ];
  if (course.scoreKind !== "none" && (from.score !== null || to.score !== null)) {
    lines.push(`${kind.en} ${from.score ?? "—"} → ${to.score ?? "—"} (${kind.better === "lower" ? "낮을수록 좋음" : "높을수록 좋음"})`);
  }
  if (from.gaisDoctor !== null || to.gaisDoctor !== null) {
    lines.push(`GAIS(원장) ${from.gaisDoctor ?? "—"} → ${to.gaisDoctor ?? "—"} (1=매우 좋아짐, 5=악화)`);
  }
  return lines.join("\n");
}
