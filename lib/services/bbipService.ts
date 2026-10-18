import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import { db } from "../db/client";
import { bbipSessions, bbipTurns } from "../db/schema";
import {
  BBIP_PROMPT_VERSION,
  type BbipSession,
  type BbipTurn,
  type Flag,
  type ParsedCase,
  type SectionKey,
  type TurnKind,
  type TurnRequest,
  type TurnStatus,
} from "../bbip/types";

// better-sqlite3 is synchronous; these functions are too.

type SessionRow = typeof bbipSessions.$inferSelect;
type TurnRow = typeof bbipTurns.$inferSelect;

function nowIso(): string {
  return new Date().toISOString();
}

function toSession(row: SessionRow): BbipSession {
  return {
    id: row.id,
    chips: row.chips,
    flags: row.flags,
    sourceNoteIds: row.sourceNoteIds,
    promptVersion: row.promptVersion,
    createdAt: row.createdAt,
  };
}

function toTurn(row: TurnRow): BbipTurn {
  return {
    id: row.id,
    sessionId: row.sessionId,
    kind: row.kind as TurnKind,
    sectionKey: (row.sectionKey ?? undefined) as SectionKey | undefined,
    question: row.question ?? undefined,
    output: row.output,
    followups: row.followups,
    model: row.model,
    status: row.status as TurnStatus,
    error: row.error ?? undefined,
    promotedEntryId: row.promotedEntryId ?? undefined,
    createdAt: row.createdAt,
  };
}

export function createSession(input: {
  chips: ParsedCase;
  flags: Flag[];
  sourceNoteIds: string[];
}): BbipSession {
  const row: SessionRow = {
    id: randomUUID(),
    chips: input.chips,
    flags: input.flags,
    sourceNoteIds: input.sourceNoteIds,
    promptVersion: BBIP_PROMPT_VERSION,
    createdAt: nowIso(),
  };
  db.insert(bbipSessions).values(row).run();
  return toSession(row);
}

export function getSession(id: string): BbipSession | null {
  const row = db.select().from(bbipSessions).where(eq(bbipSessions.id, id)).get();
  return row ? toSession(row) : null;
}

export function listSessions(limit = 30): BbipSession[] {
  return db
    .select()
    .from(bbipSessions)
    .orderBy(desc(bbipSessions.createdAt), desc(sql`rowid`))
    .limit(limit)
    .all()
    .map(toSession);
}

export function startTurn(sessionId: string, request: TurnRequest, model: string): BbipTurn {
  const row: TurnRow = {
    id: randomUUID(),
    sessionId,
    kind: request.kind,
    sectionKey: request.sectionKey ?? null,
    question: request.question ?? null,
    output: "",
    followups: [],
    model,
    status: "streaming",
    error: null,
    promotedEntryId: null,
    createdAt: nowIso(),
  };
  db.insert(bbipTurns).values(row).run();
  return toTurn(row);
}

/** `model`, when given, is the model that actually served the turn (it can
 * differ from the requested one after a server-side refusal fallback). */
export function finishTurn(turnId: string, output: string, followups: string[], model?: string): void {
  db.update(bbipTurns)
    .set({ output, followups, status: "done", error: null, ...(model ? { model } : {}) })
    .where(and(eq(bbipTurns.id, turnId), eq(bbipTurns.status, "streaming")))
    .run();
}

export function failTurn(turnId: string, output: string, error: string, model?: string): void {
  db.update(bbipTurns)
    .set({ output, status: "failed", error, ...(model ? { model } : {}) })
    .where(and(eq(bbipTurns.id, turnId), eq(bbipTurns.status, "streaming")))
    .run();
}

export function getTurn(id: string): BbipTurn | null {
  const row = db.select().from(bbipTurns).where(eq(bbipTurns.id, id)).get();
  return row ? toTurn(row) : null;
}

/** Turns in creation order (rowid breaks same-millisecond ties). */
export function listTurns(sessionId: string): BbipTurn[] {
  return db
    .select()
    .from(bbipTurns)
    .where(eq(bbipTurns.sessionId, sessionId))
    .orderBy(asc(bbipTurns.createdAt), asc(sql`rowid`))
    .all()
    .map(toTurn);
}

/** Claims the turn for promotion; false if it was already promoted. */
export function markPromoted(turnId: string, entryId: string): boolean {
  const result = db
    .update(bbipTurns)
    .set({ promotedEntryId: entryId })
    .where(and(eq(bbipTurns.id, turnId), isNull(bbipTurns.promotedEntryId)))
    .run();
  return result.changes === 1;
}

/** Closes a session's "streaming" turns that no live generator in this process owns. */
export function failOrphanedTurns(sessionId: string, activeIds: Set<string>): number {
  const orphans = db
    .select({ id: bbipTurns.id })
    .from(bbipTurns)
    .where(and(eq(bbipTurns.sessionId, sessionId), eq(bbipTurns.status, "streaming")))
    .all()
    .map((row) => row.id)
    .filter((id) => !activeIds.has(id));
  if (!orphans.length) return 0;
  return db
    .update(bbipTurns)
    .set({ status: "failed", error: "interrupted" })
    .where(and(eq(bbipTurns.status, "streaming"), inArray(bbipTurns.id, orphans)))
    .run().changes;
}

/** Marks turns stuck in "streaming" (e.g. the server died mid-stream) as failed. */
export function failStaleTurns(olderThanMs = 30 * 60_000): number {
  const cutoff = new Date(Date.now() - olderThanMs).toISOString();
  return db
    .update(bbipTurns)
    .set({ status: "failed", error: "interrupted" })
    .where(and(eq(bbipTurns.status, "streaming"), lt(bbipTurns.createdAt, cutoff)))
    .run().changes;
}
