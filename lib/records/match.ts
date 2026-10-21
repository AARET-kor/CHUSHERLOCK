// lib/records/match.ts
import { procedureKey } from "../bbip/care/sets";
import type { ParsedCase } from "../bbip/types";
import { addDays } from "./schedule";
import type { PatientCandidate, PatientSummary } from "./types";

const SPLIT = /[\s·,/|]+/;
const MIN_SCORE = 4;
const LIMIT = 3;

function words(texts: string[]): string[] {
  const out: string[] = [];
  for (const text of texts) {
    for (const part of text.split(SPLIT)) {
      const word = part.trim();
      if (word.length >= 2 && !out.includes(word)) out.push(word);
    }
  }
  return out;
}

function sameProcedure(a: string, b: string): boolean {
  const x = procedureKey(a);
  const y = procedureKey(b);
  return Boolean(x && y) && (x.includes(y) || y.includes(x));
}

/** Previous patients that look like this case. Suggestions only — the
 * doctor confirms the link. Shared feature words ×2, same procedure +3,
 * seen in the last 180 days +1; at least 4 to show. */
export function matchPatients(
  chips: ParsedCase,
  summaries: PatientSummary[],
  today: string,
  limit = LIMIT
): PatientCandidate[] {
  const caseWords = words([...chips.patient, ...chips.conditions, ...chips.meds]);
  const scored = summaries.map((summary) => {
    const featureWords = new Set(words([summary.patient.features]));
    const shared = caseWords.filter((word) => featureWords.has(word));
    const procedure = summary.procedures.find((p) => chips.procedures.some((c) => sameProcedure(p, c)));
    const recent = summary.lastVisit !== null && summary.lastVisit >= addDays(today, -180);
    const score = shared.length * 2 + (procedure ? 3 : 0) + (recent ? 1 : 0);
    const reason = [...shared, ...(procedure ? [procedure] : [])].join(" · ");
    return { patient: summary.patient, score, reason, lastVisit: summary.lastVisit ?? "" };
  });
  return scored
    .filter((c) => c.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score || b.lastVisit.localeCompare(a.lastVisit))
    .slice(0, limit)
    .map(({ patient, score, reason }) => ({ patient, score, reason }));
}
