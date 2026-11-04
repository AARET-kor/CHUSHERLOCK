// lib/services/paperService.ts
import { randomUUID } from "node:crypto";
import { and, desc, eq, gte, inArray, isNull, lt, or, sql, type SQL } from "drizzle-orm";
import { db } from "../db/client";
import { journals, papers, paperSyncRuns } from "../db/schema";
import type { LiteratureBlock, LitLevel, PaperHit, ParsedCase } from "../bbip/types";
import { JOURNAL_SEED } from "../papers/journals";
import { CONSULT_PAPERS, pickForConsult, type QueueItem } from "../papers/select";
import { topicsForCase } from "../papers/topics";
import type {
  Journal,
  PaperAnalysis,
  PaperFilters,
  PaperRecord,
  PaperRow,
  PaperStatus,
  ReviewStatus,
  SubjectKind,
  SyncKind,
  SyncRun,
  TopicKey,
} from "../papers/types";

export const PAGE_SIZE = 50;
const STUCK_AFTER_MS = 10 * 60 * 1000;
const RUN_STALE_MS = 2 * 60 * 60 * 1000;

let journalsSeeded = false;

/** Adds missing journals; never overwrites a row, so edited IFs survive. */
export function ensureJournals(force = false): void {
  if (journalsSeeded && !force) return;
  db.insert(journals).values(JOURNAL_SEED).onConflictDoNothing().run();
  journalsSeeded = true;
}

export function listJournals(): Journal[] {
  ensureJournals();
  return db
    .select()
    .from(journals)
    .orderBy(sql`${journals.impactFactor} IS NULL`, desc(journals.impactFactor), journals.ta)
    .all();
}

export function updateJournal(ta: string, patch: { impactFactor: number | null; ifYear?: number | null }): boolean {
  const result = db
    .update(journals)
    .set({ impactFactor: patch.impactFactor, ...(patch.ifYear !== undefined ? { ifYear: patch.ifYear } : {}), edited: true })
    .where(eq(journals.ta, ta))
    .run();
  return result.changes > 0;
}

type Row = typeof papers.$inferSelect;

function toPaper(row: Row, journal: { impactFactor: number | null; name: string } | null): PaperRow {
  return {
    pmid: row.pmid,
    doi: row.doi,
    pmcid: row.pmcid,
    title: row.title,
    authors: row.authors,
    year: row.year,
    journalTa: row.journalTa,
    abstract: row.abstract,
    publicationTypes: row.publicationTypes,
    level: row.level as LitLevel,
    topics: row.topics,
    status: row.status as PaperStatus,
    attempts: row.attempts,
    error: row.error,
    analysis: row.analysis ?? null,
    analysisModel: row.analysisModel,
    analyzedAt: row.analyzedAt,
    reviewStatus: row.reviewStatus as ReviewStatus,
    createdAt: row.createdAt,
    impactFactor: journal?.impactFactor ?? null,
    journalName: journal?.name ?? null,
  };
}

function findExisting(record: PaperRecord): Row | undefined {
  const byPmid = db.select().from(papers).where(eq(papers.pmid, record.pmid)).get();
  if (byPmid || !record.doi) return byPmid;
  return db.select().from(papers).where(eq(papers.doi, record.doi)).get();
}

/** true when the paper is new. A known one (same PMID or DOI) only gains the
 * topic: its analysis and review state are never touched. */
export function upsertPaper(record: PaperRecord, topic: TopicKey, now: string): boolean {
  const existing = findExisting(record);
  if (existing) {
    if (!existing.topics.includes(topic)) addTopic(existing.pmid, existing.topics, topic);
    return false;
  }
  db.insert(papers).values({ ...record, topics: [topic], createdAt: now }).run();
  return true;
}

function addTopic(pmid: string, topics: TopicKey[], topic: TopicKey): void {
  db.update(papers).set({ topics: [...topics, topic] }).where(eq(papers.pmid, pmid)).run();
}

/** PMIDs already stored; these skip efetch and only gain the topic. */
export function addTopicToKnown(pmids: string[], topic: TopicKey): Set<string> {
  const known = new Set<string>();
  for (let i = 0; i < pmids.length; i += 500) {
    const rows = db.select({ pmid: papers.pmid, topics: papers.topics }).from(papers).where(inArray(papers.pmid, pmids.slice(i, i + 500))).all();
    for (const row of rows) {
      known.add(row.pmid);
      if (!row.topics.includes(topic)) addTopic(row.pmid, row.topics, topic);
    }
  }
  return known;
}

export function getPaper(pmid: string): PaperRow | null {
  const row = db
    .select({ paper: papers, impactFactor: journals.impactFactor, name: journals.name })
    .from(papers)
    .leftJoin(journals, eq(papers.journalTa, journals.ta))
    .where(eq(papers.pmid, pmid))
    .get();
  return row ? toPaper(row.paper, row.name ? { impactFactor: row.impactFactor, name: row.name } : null) : null;
}

const subjectSql = sql`json_extract(${papers.analysis}, '$.subject.kind')`;

export function listPapers(filters: PaperFilters): { rows: PaperRow[]; total: number } {
  ensureJournals();
  const conds: SQL[] = [];
  if (filters.topic) conds.push(sql`EXISTS (SELECT 1 FROM json_each(${papers.topics}) WHERE value = ${filters.topic})`);
  if (filters.level) conds.push(eq(papers.level, filters.level));
  if (filters.subject) conds.push(sql`${subjectSql} = ${filters.subject}`);
  if (filters.analysis === "analyzed") conds.push(eq(papers.status, "analyzed"));
  if (filters.analysis === "unanalyzed") conds.push(sql`${papers.status} <> 'analyzed'`);
  if (filters.review) conds.push(eq(papers.reviewStatus, filters.review));
  const where = conds.length ? and(...conds) : undefined;
  const total = db.select({ n: sql<number>`count(*)` }).from(papers).where(where).get()!.n;
  const order =
    filters.sort === "recent"
      ? [desc(papers.year), desc(sql`CAST(${papers.pmid} AS INTEGER)`)]
      : [sql`${journals.impactFactor} IS NULL`, desc(journals.impactFactor), desc(papers.year), desc(sql`CAST(${papers.pmid} AS INTEGER)`)];
  const page = Math.max(1, filters.page ?? 1);
  const rows = db
    .select({ paper: papers, impactFactor: journals.impactFactor, name: journals.name })
    .from(papers)
    .leftJoin(journals, eq(papers.journalTa, journals.ta))
    .where(where)
    .orderBy(...order)
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE)
    .all();
  return { total, rows: rows.map((r) => toPaper(r.paper, r.name ? { impactFactor: r.impactFactor, name: r.name } : null)) };
}

/** Analyzed in the last week, newest first. */
export function recentlyAnalyzed(since: string): PaperRow[] {
  return db
    .select({ paper: papers, impactFactor: journals.impactFactor, name: journals.name })
    .from(papers)
    .leftJoin(journals, eq(papers.journalTa, journals.ta))
    .where(and(eq(papers.status, "analyzed"), gte(papers.analyzedAt, since)))
    .orderBy(desc(papers.analyzedAt))
    .limit(10)
    .all()
    .map((r) => toPaper(r.paper, r.name ? { impactFactor: r.impactFactor, name: r.name } : null));
}

/** The single gate to analysis. Atomic, so a weekly run and the button cannot
 * both start one paper; an `analyzed` row can never be claimed again. */
export function claimPaper(pmid: string, now: string): boolean {
  const result = db
    .update(papers)
    .set({ status: "analyzing", analysisStartedAt: now, attempts: sql`${papers.attempts} + 1`, error: null })
    .where(and(eq(papers.pmid, pmid), inArray(papers.status, ["pending", "failed"])))
    .run();
  return result.changes > 0;
}

export function saveAnalysis(pmid: string, analysis: PaperAnalysis, model: string, now: string): void {
  db.update(papers).set({ status: "analyzed", analysis, analysisModel: model, analyzedAt: now, error: null }).where(eq(papers.pmid, pmid)).run();
}

export function failAnalysis(pmid: string, message: string): void {
  db.update(papers).set({ status: "failed", error: message }).where(eq(papers.pmid, pmid)).run();
}

/** A restart mid-analysis leaves `analyzing` behind; free it after 10 minutes. */
export function recoverStuck(now: Date): number {
  const cutoff = new Date(now.getTime() - STUCK_AFTER_MS).toISOString();
  return db
    .update(papers)
    .set({ status: "failed", error: "분석이 중단되었습니다." })
    .where(and(eq(papers.status, "analyzing"), or(isNull(papers.analysisStartedAt), lt(papers.analysisStartedAt, cutoff))))
    .run().changes;
}

export function setReview(pmid: string, review: ReviewStatus, now: string): boolean {
  return db.update(papers).set({ reviewStatus: review, reviewedAt: now }).where(eq(papers.pmid, pmid)).run().changes > 0;
}

export function weeklyQueue(): QueueItem[] {
  return db
    .select({ pmid: papers.pmid, topics: papers.topics, impactFactor: journals.impactFactor, year: papers.year, attempts: papers.attempts })
    .from(papers)
    .leftJoin(journals, eq(papers.journalTa, journals.ta))
    .where(and(inArray(papers.status, ["pending", "failed"]), sql`${papers.reviewStatus} <> 'excluded'`))
    .all();
}

function toHit(paper: PaperRow): PaperHit {
  return {
    pmid: paper.pmid,
    title: paper.title,
    authors: paper.authors,
    ...(paper.year ? { year: paper.year } : {}),
    journal: paper.journalTa,
    abstract: paper.abstract,
    publicationTypes: paper.publicationTypes,
    level: paper.level,
    library: true,
    reviewStatus: paper.reviewStatus,
    ...(paper.analysis ? { analysis: paper.analysis } : {}),
    ...(paper.impactFactor !== null ? { impactFactor: paper.impactFactor } : {}),
  };
}

/** Up to 5 library papers for a consult, as the session's literature block.
 * undefined when the case touches no topic or the library has nothing. */
export function literatureForCase(chips: Pick<ParsedCase, "procedures" | "conditions">, now: string): LiteratureBlock | undefined {
  const topics = topicsForCase(chips);
  if (topics.length === 0) return undefined;
  const topicList = sql.join(topics.map((t) => sql`${t}`), sql`, `);
  const candidates = db
    .select({
      pmid: papers.pmid,
      status: papers.status,
      subjectKind: sql<SubjectKind | null>`${subjectSql}`,
      level: papers.level,
      impactFactor: journals.impactFactor,
      year: papers.year,
      reviewStatus: papers.reviewStatus,
    })
    .from(papers)
    .leftJoin(journals, eq(papers.journalTa, journals.ta))
    .where(sql`EXISTS (SELECT 1 FROM json_each(${papers.topics}) WHERE value IN (${topicList}))`)
    .all();
  const picks = pickForConsult(
    candidates.map((c) => ({
      pmid: c.pmid,
      analyzed: c.status === "analyzed",
      subjectKind: c.subjectKind,
      level: c.level as LitLevel,
      impactFactor: c.impactFactor,
      year: c.year,
      reviewStatus: c.reviewStatus as ReviewStatus,
    })),
    CONSULT_PAPERS
  );
  if (picks.length === 0) return undefined;
  return {
    pubmedQuery: "",
    webQuery: "",
    papers: picks.map((pmid) => toHit(getPaper(pmid)!)),
    web: [],
    errors: {},
    fetchedAt: now,
  };
}

type RunRow = typeof paperSyncRuns.$inferSelect;
const toRun = (row: RunRow): SyncRun => ({ ...row, kind: row.kind as SyncKind });

export function startRun(kind: SyncKind, now: string): SyncRun {
  const row: RunRow = { id: randomUUID(), kind, startedAt: now, finishedAt: null, added: 0, analyzed: 0, error: null };
  db.insert(paperSyncRuns).values(row).run();
  return toRun(row);
}

export function finishRun(id: string, result: { added: number; analyzed: number; error: string | null }, now: string): void {
  db.update(paperSyncRuns).set({ ...result, finishedAt: now }).where(eq(paperSyncRuns.id, id)).run();
}

/** The unfinished run, ignoring one a crash left behind more than 2 h ago. */
export function activeRun(now: Date): SyncRun | null {
  const cutoff = new Date(now.getTime() - RUN_STALE_MS).toISOString();
  const row = db
    .select()
    .from(paperSyncRuns)
    .where(and(isNull(paperSyncRuns.finishedAt), gte(paperSyncRuns.startedAt, cutoff)))
    .orderBy(desc(paperSyncRuns.startedAt))
    .get();
  return row ? toRun(row) : null;
}

export function latestRun(): SyncRun | null {
  const row = db.select().from(paperSyncRuns).orderBy(desc(paperSyncRuns.startedAt)).get();
  return row ? toRun(row) : null;
}

/** Collection resumes from here; a failed run leaves it alone. */
export function lastSuccessfulStart(): string | null {
  return (
    db
      .select({ startedAt: paperSyncRuns.startedAt })
      .from(paperSyncRuns)
      .where(and(sql`${paperSyncRuns.finishedAt} IS NOT NULL`, isNull(paperSyncRuns.error)))
      .orderBy(desc(paperSyncRuns.startedAt))
      .get()?.startedAt ?? null
  );
}

export function weeklyAttemptsSince(since: string): number {
  return db
    .select({ n: sql<number>`coalesce(sum(${paperSyncRuns.analyzed}), 0)` })
    .from(paperSyncRuns)
    .where(and(eq(paperSyncRuns.kind, "weekly"), gte(paperSyncRuns.startedAt, since)))
    .get()!.n;
}
