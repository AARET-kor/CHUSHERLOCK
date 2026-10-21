// lib/records/history.ts
import { neutralizeTags } from "../bbip/prompts";
import { SCORE_KINDS, STATUS_LABEL, type PatientRecord } from "./types";

const MAX_COURSES = 3;

const clean = (text: string) => neutralizeTags(text).replace(/\s+/g, " ").trim().slice(0, 160);

/** The patient's earlier course as prompt context. Clinical facts only:
 * no chart number, alias, features, memo or visit notes ever go in. */
export function buildHistoryBlock(record: PatientRecord | null): string {
  if (!record || record.courses.length === 0) return "";
  const lines: string[] = [];
  for (const course of record.courses.slice(0, MAX_COURSES)) {
    const sessions = course.visits.filter((v) => v.kind === "session");
    const last = course.visits.at(-1);
    const head = clean([course.procedure, course.indication].filter(Boolean).join(" · "));
    const planned = course.plannedSessions ? ` / 계획 ${course.plannedSessions}회` : "";
    lines.push(
      `- ${head} (${STATUS_LABEL[course.status].ko}): ${sessions.length}회 시행${planned}, 시작 ${course.startedAt}${
        last ? `, 마지막 방문 ${last.date}` : ""
      }`
    );
    const withParams = [...course.visits].reverse().find((v) => v.product || v.params);
    if (withParams) lines.push(`  · 마지막 제품·파라미터: ${clean([withParams.product, withParams.params].filter(Boolean).join(" "))}`);
    const kind = SCORE_KINDS[course.scoreKind];
    const scores = course.visits.filter((v) => v.score !== null).map((v) => v.score);
    if (kind.better && scores.length) {
      lines.push(`  · ${kind.en} 추이: ${scores.join(" → ")} (${kind.better === "lower" ? "낮을수록 좋음" : "높을수록 좋음"})`);
    }
    const gais = course.visits.filter((v) => v.gaisDoctor !== null).map((v) => v.gaisDoctor);
    if (gais.length) lines.push(`  · GAIS(원장) 추이: ${gais.join(" → ")} (1=매우 좋아짐 … 5=악화)`);
  }
  return `<history>\n${lines.join("\n")}\n</history>`;
}
