import { randomUUID } from "node:crypto";
import { eq, and, inArray, desc } from "drizzle-orm";
import { db } from "../db/client";
import { entries, sources, entrySources, entryRelations, figures } from "../db/schema";
import type { CodexEntry, SourceRef } from "../codex/types";
import { getCategory } from "../codex/taxonomy";
import { findOverlapCandidates, type OverlapCandidate } from "../codex/overlap";
import { findSemanticRelatedIds } from "../ai/relatedness";
import type { CreateEntryInput, UpdateEntryInput } from "../schemas/entrySchemas";

export interface EntryFilter {
  categoryKey?: string;
  tier?: string;
  status?: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

async function hydrateEntry(row: typeof entries.$inferSelect): Promise<CodexEntry> {
  const entrySourceRows = await db
    .select({ source: sources })
    .from(entrySources)
    .innerJoin(sources, eq(entrySources.sourceId, sources.id))
    .where(eq(entrySources.entryId, row.id));

  const relationRows = await db
    .select({ relatedEntryId: entryRelations.relatedEntryId })
    .from(entryRelations)
    .where(eq(entryRelations.entryId, row.id));

  return {
    id: row.id,
    title: row.title,
    content: row.content,
    categoryKey: row.categoryKey,
    tier: row.tier as CodexEntry["tier"],
    tags: row.tags,
    status: row.status as CodexEntry["status"],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    sources: entrySourceRows.map(({ source }) => ({
      id: source.id,
      type: source.type as SourceRef["type"],
      citation: source.citation,
      url: source.url ?? undefined,
      authors: source.authors ?? undefined,
      year: source.year ?? undefined,
    })),
    relatedEntryIds: relationRows.map((r) => r.relatedEntryId),
  };
}

export async function listEntries(filter: EntryFilter = {}): Promise<CodexEntry[]> {
  const conditions = [];
  if (filter.categoryKey) conditions.push(eq(entries.categoryKey, filter.categoryKey));
  if (filter.tier) conditions.push(eq(entries.tier, filter.tier));
  if (filter.status) conditions.push(eq(entries.status, filter.status));

  const rows = conditions.length
    ? await db.select().from(entries).where(and(...conditions))
    : await db.select().from(entries);

  return Promise.all(rows.map(hydrateEntry));
}

export async function getEntry(id: string): Promise<CodexEntry | null> {
  const [row] = await db.select().from(entries).where(eq(entries.id, id));
  if (!row) return null;
  return hydrateEntry(row);
}

/** Overlap candidates for a prospective title/category, before the entry is
 * saved — used by the UI to warn "this looks like an existing note". */
export async function previewOverlaps(
  title: string,
  categoryKey: string
): Promise<Array<OverlapCandidate & { similarity: number }>> {
  const existing = await db
    .select({ id: entries.id, title: entries.title, categoryKey: entries.categoryKey })
    .from(entries);
  return findOverlapCandidates(title, categoryKey, existing);
}

async function resolveOrCreateSource(input: CreateEntryInput["sources"][number]): Promise<string> {
  const [existing] = await db
    .select({ id: sources.id })
    .from(sources)
    .where(eq(sources.citation, input.citation));
  if (existing) return existing.id;

  const id = randomUUID();
  await db.insert(sources).values({
    id,
    type: input.type,
    citation: input.citation,
    url: input.url || null,
    authors: input.authors || null,
    year: input.year ?? null,
  });
  return id;
}

export interface CreateEntryResult {
  entry: CodexEntry;
  overlaps: Array<OverlapCandidate & { similarity: number }>;
}

/** Same-category entries offered to the semantic relatedness check,
 * newest first, capped so the prompt stays small. */
const SEMANTIC_CANDIDATE_LIMIT = 40;

async function semanticRelatedIds(input: CreateEntryInput): Promise<string[]> {
  const candidateRows = await db
    .select({ id: entries.id, title: entries.title, content: entries.content })
    .from(entries)
    .where(eq(entries.categoryKey, input.categoryKey))
    .orderBy(desc(entries.updatedAt))
    .limit(SEMANTIC_CANDIDATE_LIMIT);

  if (candidateRows.length === 0) return [];

  const category = getCategory(input.categoryKey);
  return findSemanticRelatedIds({
    newNote: {
      title: input.title,
      content: input.content,
      categoryLabel: `${category.labelKo} / ${category.labelEn}`,
    },
    candidates: candidateRows.map((row) => ({
      id: row.id,
      title: row.title,
      excerpt: row.content.slice(0, 300),
    })),
  });
}

/** Creates an entry and auto-links it to related existing entries: a fast
 * title-similarity pass (lib/codex/overlap.ts) plus a semantic pass where
 * the model judges same-category notes for genuine topic overlap
 * (lib/ai/relatedness.ts — never throws, degrades to the heuristic). */
export async function createEntry(input: CreateEntryInput): Promise<CreateEntryResult> {
  const overlaps = await previewOverlaps(input.title, input.categoryKey);
  const semanticIds = await semanticRelatedIds(input);
  const relatedEntryIds = Array.from(
    new Set([...input.relatedEntryIds, ...overlaps.map((o) => o.id), ...semanticIds])
  );

  const id = randomUUID();
  const timestamp = nowIso();

  const sourceIds = await Promise.all(input.sources.map(resolveOrCreateSource));

  await db.insert(entries).values({
    id,
    title: input.title,
    content: input.content,
    categoryKey: input.categoryKey,
    tier: input.tier,
    tags: input.tags,
    status: input.status,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  if (sourceIds.length > 0) {
    await db.insert(entrySources).values(sourceIds.map((sourceId) => ({ entryId: id, sourceId })));
  }

  if (relatedEntryIds.length > 0) {
    await db.insert(entryRelations).values(
      relatedEntryIds.flatMap((relatedId) => [
        { entryId: id, relatedEntryId: relatedId },
        { entryId: relatedId, relatedEntryId: id },
      ])
    );
  }

  const entry = await getEntry(id);
  if (!entry) throw new Error("Failed to load entry immediately after creation.");
  return { entry, overlaps };
}

export async function updateEntry(input: UpdateEntryInput): Promise<CodexEntry> {
  const existing = await getEntry(input.id);
  if (!existing) throw new Error(`Entry not found: ${input.id}`);

  await db
    .update(entries)
    .set({
      title: input.title ?? existing.title,
      content: input.content ?? existing.content,
      categoryKey: input.categoryKey ?? existing.categoryKey,
      tier: input.tier ?? existing.tier,
      tags: input.tags ?? existing.tags,
      status: input.status ?? existing.status,
      updatedAt: nowIso(),
    })
    .where(eq(entries.id, input.id));

  const updated = await getEntry(input.id);
  if (!updated) throw new Error(`Entry disappeared during update: ${input.id}`);
  return updated;
}

export async function deleteEntry(id: string): Promise<void> {
  await db.delete(entries).where(eq(entries.id, id));
}

/** Bind cropped source figures to the entry that now uses them. */
export async function attachFiguresToEntry(entryId: string, figureIds: string[]): Promise<void> {
  if (figureIds.length === 0) return;
  await db.update(figures).set({ entryId }).where(inArray(figures.id, figureIds));
}

/** id → filename for the figures attached to the given entries (used by the
 * Obsidian export to bundle image files and rewrite links). */
export async function figureFilesForEntries(entryIds: string[]): Promise<Map<string, string>> {
  if (entryIds.length === 0) return new Map();
  const rows = await db
    .select({ id: figures.id, filename: figures.filename })
    .from(figures)
    .where(inArray(figures.entryId, entryIds));
  return new Map(rows.map((r) => [r.id, r.filename]));
}

export async function markExported(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await db
    .update(entries)
    .set({ exportedAt: nowIso() })
    .where(inArray(entries.id, ids));
}
