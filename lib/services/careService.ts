// lib/services/careService.ts
import { randomUUID } from "node:crypto";
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "../db/client";
import { bbipCareOrders, bbipCareSets } from "../db/schema";
import { procedureKey } from "../bbip/care/sets";
import type { CareItem, CareOrder, CareSet } from "../bbip/care/types";

// better-sqlite3 is synchronous; these functions are too.

type OrderRow = typeof bbipCareOrders.$inferSelect;
type SetRow = typeof bbipCareSets.$inferSelect;

function nowIso(): string {
  return new Date().toISOString();
}

function toOrder(row: OrderRow): CareOrder {
  return {
    id: row.id,
    sessionId: row.sessionId,
    items: row.items,
    setKeys: row.setKeys,
    caution: row.caution,
    notices: row.notices,
    model: row.model,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toSet(row: SetRow): CareSet {
  return {
    id: row.id,
    procedureKey: row.procedureKey,
    label: row.label,
    items: row.items,
    ...(row.sourceSessionId ? { sourceSessionId: row.sourceSessionId } : {}),
    updatedAt: row.updatedAt,
  };
}

export interface NewCareOrder {
  sessionId: string;
  items: CareItem[];
  setKeys: string[];
  caution: string;
  notices: string[];
  model: string;
}

/** One order per session: a new one replaces the old in one transaction. */
export function saveCareOrder(input: NewCareOrder): CareOrder {
  const now = nowIso();
  const row: OrderRow = { id: randomUUID(), ...input, createdAt: now, updatedAt: now };
  db.transaction((tx) => {
    tx.delete(bbipCareOrders).where(eq(bbipCareOrders.sessionId, input.sessionId)).run();
    tx.insert(bbipCareOrders).values(row).run();
  });
  return toOrder(row);
}

export function getCareOrder(sessionId: string): CareOrder | null {
  const row = db.select().from(bbipCareOrders).where(eq(bbipCareOrders.sessionId, sessionId)).get();
  return row ? toOrder(row) : null;
}

export function getCareOrderById(id: string): CareOrder | null {
  const row = db.select().from(bbipCareOrders).where(eq(bbipCareOrders.id, id)).get();
  return row ? toOrder(row) : null;
}

export function updateCareItems(id: string, items: CareItem[]): CareOrder | null {
  const result = db.update(bbipCareOrders).set({ items, updatedAt: nowIso() }).where(eq(bbipCareOrders.id, id)).run();
  return result.changes === 1 ? getCareOrderById(id) : null;
}

/** Sets for the case's procedure chips, in chip order. */
export function getCareSetsFor(procedures: string[]): CareSet[] {
  const keys = Array.from(new Set(procedures.map(procedureKey).filter(Boolean)));
  if (keys.length === 0) return [];
  const rows = db.select().from(bbipCareSets).where(inArray(bbipCareSets.procedureKey, keys)).all();
  return rows.sort((a, b) => keys.indexOf(a.procedureKey) - keys.indexOf(b.procedureKey)).map(toSet);
}

/** Saves (or overwrites) the set of one procedure. */
export function saveCareSet(input: { label: string; items: CareItem[]; sourceSessionId?: string }): CareSet {
  const key = procedureKey(input.label);
  const values = {
    label: input.label.trim(),
    items: input.items,
    sourceSessionId: input.sourceSessionId ?? null,
    updatedAt: nowIso(),
  };
  db.insert(bbipCareSets)
    .values({ id: randomUUID(), procedureKey: key, ...values })
    .onConflictDoUpdate({ target: bbipCareSets.procedureKey, set: values })
    .run();
  return toSet(db.select().from(bbipCareSets).where(eq(bbipCareSets.procedureKey, key)).get()!);
}

export function listCareSets(): CareSet[] {
  return db.select().from(bbipCareSets).orderBy(desc(bbipCareSets.updatedAt)).all().map(toSet);
}

export function deleteCareSet(id: string): boolean {
  return db.delete(bbipCareSets).where(eq(bbipCareSets.id, id)).run().changes === 1;
}
