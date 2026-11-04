// lib/papers/run.ts
// The moving parts of the library: collect from PubMed, analyze one paper,
// and the weekly sync that ties them together under the 5-a-week budget.
import { isFakeMode } from "../ai/client";
import {
  activeRun,
  addTopicToKnown,
  claimPaper,
  ensureJournals,
  failAnalysis,
  finishRun,
  getPaper,
  lastSuccessfulStart,
  listJournals,
  recoverStuck,
  analyzedWithoutMarks,
  saveAnalysis,
  saveMarks,
  startRun,
  upsertPaper,
  weeklyAttemptsSince,
  weeklyQueue,
} from "../services/paperService";
import { AnalysisError, analyzeText, anthropicPaperCaller, FAKE_QUOTE, fakeAnalysisJson, type PaperCaller } from "./analyze";
import { capText, fetchFullText } from "./fulltext";
import { fakeMarksJson, markAnalysis } from "./marks";
import { fetchPaperRecords, searchPmids } from "./pubmed";
import { pickWeekly, WEEKLY_ANALYSES } from "./select";
import { topicTerm } from "./topics";
import { TOPIC_KEYS, type PaperAnalysis, type PaperRecord, type PenMark, type SyncKind, type SyncRun } from "./types";

export interface PaperDeps {
  search: (term: string) => Promise<string[]>;
  fetchRecords: (pmids: string[]) => Promise<PaperRecord[]>;
  fullText: (pmcid: string) => Promise<string | null>;
  callModel: PaperCaller;
  /** Pen marks. Without it, or if it fails, the analysis stays unmarked. */
  callMarks?: PaperCaller;
  now: () => Date;
}

let fakeCounter = 0;

/** CODEX_AI_MODE=fake: new ids on every search so repeated E2E runs on the
 * persistent DB always have an unanalyzed paper. No network, no model. */
function fakeDeps(): PaperDeps {
  return {
    search: async () => {
      fakeCounter += 1;
      return [String((Date.now() % 90_000_000) + 100_000_000 + fakeCounter)];
    },
    fetchRecords: async (pmids) =>
      pmids.map((pmid) => ({
        pmid,
        doi: null,
        pmcid: null,
        title: `[FAKE] Hyaluronidase and filler study ${pmid}`,
        authors: ["Fake A"],
        year: 2026,
        journalTa: "Aesthet Surg J",
        abstract: `FAKE 초록입니다. ${FAKE_QUOTE}.`,
        publicationTypes: ["Observational Study"],
        level: "observational" as const,
      })),
    fullText: async () => null,
    callModel: async () => ({ text: fakeAnalysisJson(), model: "fake", stopReason: "end_turn" }),
    callMarks: async () => ({ text: fakeMarksJson(), model: "fake", stopReason: "end_turn" }),
    now: () => new Date(),
  };
}

export function defaultPaperDeps(): PaperDeps {
  if (isFakeMode()) return fakeDeps();
  return {
    search: (term) => searchPmids(term),
    fetchRecords: (pmids) => fetchPaperRecords(pmids),
    fullText: (pmcid) => fetchFullText(pmcid),
    callModel: anthropicPaperCaller,
    callMarks: anthropicPaperCaller,
    now: () => new Date(),
  };
}

export class PaperNotFoundError extends Error {
  constructor() {
    super("논문을 찾을 수 없습니다.");
    this.name = "PaperNotFoundError";
  }
}
export class AlreadyAnalyzedError extends Error {
  constructor() {
    super("이미 분석한 논문입니다.");
    this.name = "AlreadyAnalyzedError";
  }
}
export class SyncRunningError extends Error {
  constructor() {
    super("이미 수집이 진행 중입니다.");
    this.name = "SyncRunningError";
  }
}

/** A failed mark call must never cost a finished analysis. */
async function penMarks(analysis: PaperAnalysis, deps: PaperDeps): Promise<PenMark[]> {
  if (!deps.callMarks) return [];
  try {
    return await markAnalysis(analysis, deps.callMarks);
  } catch {
    return [];
  }
}

/** Marks analyses that have none, without touching their text. Returns the count. */
export async function markUnmarked(deps: PaperDeps = defaultPaperDeps()): Promise<number> {
  let marked = 0;
  for (const paper of analyzedWithoutMarks()) {
    const marks = await penMarks(paper.analysis, deps);
    if (marks.length === 0) continue;
    saveMarks(paper.pmid, paper.analysis, marks);
    marked += 1;
  }
  return marked;
}

export async function analyzeOne(pmid: string, deps: PaperDeps = defaultPaperDeps()): Promise<void> {
  const paper = getPaper(pmid);
  if (!paper) throw new PaperNotFoundError();
  if (!claimPaper(pmid, deps.now().toISOString())) throw new AlreadyAnalyzedError();
  try {
    const body = paper.pmcid ? await deps.fullText(paper.pmcid) : null;
    const { analysis, model } = await analyzeText(
      {
        record: paper,
        sourceText: body ? capText(body) : paper.abstract,
        source: body ? "fulltext" : "abstract",
      },
      deps.callModel
    );
    const marks = await penMarks(analysis, deps);
    saveAnalysis(pmid, marks.length ? { ...analysis, marks } : analysis, model, deps.now().toISOString());
  } catch (error) {
    failAnalysis(pmid, error instanceof AnalysisError ? error.message : "분석에 실패했습니다.");
    throw error;
  }
}

const FIRST_RUN_YEARS = 5;
const OVERLAP_MS = 24 * 60 * 60 * 1000;

function searchFrom(now: Date): string {
  const last = lastSuccessfulStart();
  const from = last ? new Date(new Date(last).getTime() - OVERLAP_MS) : new Date(Date.UTC(now.getUTCFullYear() - FIRST_RUN_YEARS, now.getUTCMonth(), now.getUTCDate()));
  return from.toISOString().slice(0, 10).replaceAll("-", "/");
}

/** New papers across every topic. Throws on a PubMed failure so the run is
 * marked failed and the next one covers the same period again. */
export async function collect(deps: PaperDeps): Promise<number> {
  ensureJournals();
  const tas = listJournals().map((journal) => journal.ta);
  const from = searchFrom(deps.now());
  const now = deps.now().toISOString();
  let added = 0;
  for (const topic of TOPIC_KEYS) {
    const pmids = await deps.search(topicTerm(topic, tas, from));
    const known = addTopicToKnown(pmids, topic);
    const fresh = pmids.filter((pmid) => !known.has(pmid));
    if (fresh.length === 0) continue;
    for (const record of await deps.fetchRecords(fresh)) {
      if (upsertPaper(record, topic, now)) added += 1;
    }
  }
  return added;
}

const BUDGET_WINDOW_MS = 6 * 24 * 60 * 60 * 1000;

/** Attempts still available this week. Failed attempts count, so a broken
 * prompt cannot spend more than the limit, and a double trigger spends nothing. */
function weeklyBudget(now: Date): number {
  const since = new Date(now.getTime() - BUDGET_WINDOW_MS).toISOString();
  return Math.max(0, WEEKLY_ANALYSES - weeklyAttemptsSince(since));
}

export async function runSync(run: SyncRun, deps: PaperDeps = defaultPaperDeps()): Promise<void> {
  let added = 0;
  let attempts = 0;
  let failure: string | null = null;
  try {
    recoverStuck(deps.now());
    added = await collect(deps);
    if (run.kind === "weekly") {
      for (const pmid of pickWeekly(weeklyQueue(), weeklyBudget(deps.now()))) {
        attempts += 1;
        // One paper failing must not stop the rest; it stays retryable.
        await analyzeOne(pmid, deps).catch((error: unknown) => {
          console.warn(`[papers] analysis of ${pmid} failed:`, error instanceof Error ? error.message : "unknown");
        });
      }
    }
  } catch (error) {
    failure = error instanceof Error ? error.message : "수집에 실패했습니다.";
    console.error("[papers] sync failed:", failure);
  }
  finishRun(run.id, { added, analyzed: attempts, error: failure }, deps.now().toISOString());
}

/** Starts a sync in the background and returns at once. The server process
 * stays alive, so the HTTP request does not have to wait for it. */
export function startSync(kind: SyncKind, deps: PaperDeps = defaultPaperDeps()): { run: SyncRun; done: Promise<void> } {
  if (activeRun(deps.now())) throw new SyncRunningError();
  const run = startRun(kind, deps.now().toISOString());
  return { run, done: runSync(run, deps) };
}
