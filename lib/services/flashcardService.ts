import { randomUUID } from "node:crypto";
import { eq, and, lte, asc } from "drizzle-orm";
import { db } from "../db/client";
import { flashcards, entries } from "../db/schema";
import { getEntry } from "./entryService";
import {
  schedule,
  newCardState,
  dueLabel,
  type Rating,
  type CardState,
  type CardStatus,
} from "../srs/scheduler";
import { defaultFlashcardCaller, type FlashcardCaller } from "../ai/flashcards";

export interface FlashcardView {
  id: string;
  entryId: string;
  entryTitle: string;
  front: string;
  back: string;
  status: CardStatus;
  learningStep: number;
  easeMilli: number;
  reps: number;
  lapses: number;
  intervalDays: number;
  dueAt: string;
  dueLabel: string;
}

type Row = typeof flashcards.$inferSelect;

function nowIso(): string {
  return new Date().toISOString();
}

function rowToState(row: Row): CardState {
  return {
    status: row.status as CardStatus,
    learningStep: row.learningStep,
    easeMilli: row.easeMilli,
    intervalDays: row.intervalDays,
    reps: row.reps,
    lapses: row.lapses,
  };
}

async function toView(row: Row, titleById: Map<string, string>): Promise<FlashcardView> {
  const minutesUntilDue = (new Date(row.dueAt).getTime() - Date.now()) / 60000;
  return {
    id: row.id,
    entryId: row.entryId,
    entryTitle: titleById.get(row.entryId) ?? "(삭제된 노트)",
    front: row.front,
    back: row.back,
    status: row.status as CardStatus,
    learningStep: row.learningStep,
    easeMilli: row.easeMilli,
    reps: row.reps,
    lapses: row.lapses,
    intervalDays: row.intervalDays,
    dueAt: row.dueAt,
    dueLabel: dueLabel(Math.max(0, minutesUntilDue)),
  };
}

/** Generate flashcards for a note (via the model) and persist them, due now.
 * Skips generation if the note already has cards unless `regenerate`. */
export async function generateCardsForEntry(
  entryId: string,
  options: { caller?: FlashcardCaller; regenerate?: boolean } = {}
): Promise<{ created: number }> {
  const entry = await getEntry(entryId);
  if (!entry) throw new Error("노트를 찾을 수 없습니다.");

  const existing = await db
    .select({ id: flashcards.id })
    .from(flashcards)
    .where(eq(flashcards.entryId, entryId));
  if (existing.length > 0 && !options.regenerate) {
    return { created: 0 };
  }
  if (existing.length > 0 && options.regenerate) {
    await db.delete(flashcards).where(eq(flashcards.entryId, entryId));
  }

  const caller = options.caller ?? defaultFlashcardCaller();
  const generated = await caller({ title: entry.title, content: entry.content });
  if (generated.length === 0) return { created: 0 };

  const ts = nowIso();
  const rows = generated.map((c) => {
    const state = newCardState();
    return {
      id: randomUUID(),
      entryId,
      front: c.front,
      back: c.back,
      status: state.status,
      learningStep: state.learningStep,
      easeMilli: state.easeMilli,
      intervalDays: state.intervalDays,
      reps: state.reps,
      lapses: state.lapses,
      dueAt: ts, // due immediately
      createdAt: ts,
      updatedAt: ts,
      lastReviewedAt: null,
    };
  });
  await db.insert(flashcards).values(rows);
  return { created: rows.length };
}

/** Cards due for review now (dueAt <= now), oldest-due first. */
export async function listDueCards(limit = 40): Promise<FlashcardView[]> {
  const rows = await db
    .select()
    .from(flashcards)
    .where(lte(flashcards.dueAt, nowIso()))
    .orderBy(asc(flashcards.dueAt))
    .limit(limit);
  return hydrate(rows);
}

export async function listCardsForEntry(entryId: string): Promise<FlashcardView[]> {
  const rows = await db.select().from(flashcards).where(eq(flashcards.entryId, entryId));
  return hydrate(rows);
}

async function hydrate(rows: Row[]): Promise<FlashcardView[]> {
  if (rows.length === 0) return [];
  const titleRows = await db.select({ id: entries.id, title: entries.title }).from(entries);
  const titleById = new Map(titleRows.map((r) => [r.id, r.title]));
  return Promise.all(rows.map((r) => toView(r, titleById)));
}

/** Grade a card; the scheduler computes its next state and due time. */
export async function reviewCard(
  cardId: string,
  rating: Rating
): Promise<{ dueLabel: string; dueAt: string } | null> {
  const [row] = await db.select().from(flashcards).where(eq(flashcards.id, cardId));
  if (!row) return null;

  const result = schedule(rowToState(row), rating);
  const dueAt = new Date(Date.now() + result.dueInMinutes * 60000).toISOString();
  const ts = nowIso();

  await db
    .update(flashcards)
    .set({
      status: result.status,
      learningStep: result.learningStep,
      easeMilli: result.easeMilli,
      intervalDays: result.intervalDays,
      reps: result.reps,
      lapses: result.lapses,
      dueAt,
      updatedAt: ts,
      lastReviewedAt: ts,
    })
    .where(eq(flashcards.id, cardId));

  return { dueLabel: dueLabel(result.dueInMinutes), dueAt };
}

export interface FlashcardStats {
  total: number;
  due: number;
  learning: number;
  review: number;
  lapsed: number;
  /** Notes that have at least one card. */
  notesWithCards: number;
}

export async function flashcardStats(): Promise<FlashcardStats> {
  const rows = await db
    .select({
      status: flashcards.status,
      dueAt: flashcards.dueAt,
      entryId: flashcards.entryId,
    })
    .from(flashcards);
  const now = nowIso();
  const noteSet = new Set<string>();
  let due = 0;
  let learning = 0;
  let review = 0;
  let lapsed = 0;
  for (const r of rows) {
    noteSet.add(r.entryId);
    if (r.dueAt <= now) due += 1;
    if (r.status === "learning") learning += 1;
    else if (r.status === "review") review += 1;
    else if (r.status === "lapsed") lapsed += 1;
  }
  return { total: rows.length, due, learning, review, lapsed, notesWithCards: noteSet.size };
}

export async function deleteCard(cardId: string): Promise<void> {
  await db.delete(flashcards).where(eq(flashcards.id, cardId));
}

/** Notes with ≥1 card — used to show/hide the "카드 만들기" action. */
export async function entriesWithCards(): Promise<Set<string>> {
  const rows = await db.select({ entryId: flashcards.entryId }).from(flashcards);
  return new Set(rows.map((r) => r.entryId));
}

export async function dueCardCount(): Promise<number> {
  const rows = await db
    .select({ id: flashcards.id })
    .from(flashcards)
    .where(and(lte(flashcards.dueAt, nowIso())));
  return rows.length;
}
