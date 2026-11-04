// lib/papers/select.ts
// Which papers get the weekly analyses and which reach a consult brief. Pure.
import type { LitLevel } from "../bbip/types";
import { TOPIC_KEYS, type ReviewStatus, type SubjectKind, type TopicKey } from "./types";

export const WEEKLY_ANALYSES = 5;
export const MAX_ATTEMPTS = 3;
export const CONSULT_PAPERS = 5;

export interface QueueItem {
  pmid: string;
  topics: TopicKey[];
  impactFactor: number | null;
  year: number | null;
  attempts: number;
}

const byImpact = (a: { impactFactor: number | null; year: number | null; pmid: string }, b: typeof a) =>
  (b.impactFactor ?? -1) - (a.impactFactor ?? -1) || (b.year ?? 0) - (a.year ?? 0) || Number(b.pmid) - Number(a.pmid);

/** One best paper per topic, then by IF: pure IF order would spend every week
 * on filler and pigment papers and never reach thread lifts. */
export function pickWeekly(items: QueueItem[], limit: number): string[] {
  const queue = items.filter((item) => item.attempts < MAX_ATTEMPTS).sort(byImpact);
  const picked: string[] = [];
  for (const topic of TOPIC_KEYS) {
    if (picked.length >= limit) break;
    const best = queue.find((item) => item.topics.includes(topic) && !picked.includes(item.pmid));
    if (best) picked.push(best.pmid);
  }
  for (const item of queue) {
    if (picked.length >= limit) break;
    if (!picked.includes(item.pmid)) picked.push(item.pmid);
  }
  return picked;
}

export interface ConsultCandidate {
  pmid: string;
  analyzed: boolean;
  subjectKind: SubjectKind | null;
  level: LitLevel;
  impactFactor: number | null;
  year: number | null;
  reviewStatus: ReviewStatus;
}

const SUBJECT_RANK: Record<SubjectKind, number> = { human: 0, review: 1, unclear: 2, in_vitro: 3, animal: 3 };
const LEVEL_RANK: Record<LitLevel, number> = { guideline: 0, meta: 1, rct: 2, observational: 3, case: 4, other: 5 };

/** Analyzed → human → evidence level → IF. Unlike the IF-sorted list, so a
 * rat study in a higher-IF journal never outranks a human long-term follow-up. */
export function pickForConsult(candidates: ConsultCandidate[], limit: number): string[] {
  return candidates
    .filter((paper) => paper.reviewStatus !== "excluded")
    .sort(
      (a, b) =>
        Number(b.analyzed) - Number(a.analyzed) ||
        SUBJECT_RANK[a.subjectKind ?? "unclear"] - SUBJECT_RANK[b.subjectKind ?? "unclear"] ||
        LEVEL_RANK[a.level] - LEVEL_RANK[b.level] ||
        byImpact(a, b)
    )
    .slice(0, limit)
    .map((paper) => paper.pmid);
}
