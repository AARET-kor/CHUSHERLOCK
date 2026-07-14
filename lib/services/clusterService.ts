import { randomUUID } from "node:crypto";
import { eq, inArray, asc } from "drizzle-orm";
import { db } from "../db/client";
import { clusters, clusterEntries, entries } from "../db/schema";
import { getCategory } from "../codex/taxonomy";
import { getTierInfo } from "../codex/tiers";
import type { CodexEntry } from "../codex/types";
import { getEntry, listEntries } from "./entryService";
import {
  defaultClusterCaller,
  type ClusterCaller,
  type ClusterNoteDigest,
} from "../ai/clusters";

/** Pull the note's 한눈에 보기 summary if present, else a trimmed excerpt —
 * a compact digest for the clustering model instead of the full body. */
export function noteDigest(content: string, maxChars = 280): string {
  const lines = content.split("\n");
  const headerIndex = lines.findIndex((l) => l.trim().startsWith("> **한눈에 보기**"));
  if (headerIndex >= 0) {
    const summary: string[] = [];
    for (let i = headerIndex + 1; i < lines.length; i++) {
      const trimmed = lines[i]!.trim();
      if (!trimmed.startsWith(">")) break;
      summary.push(trimmed.replace(/^>\s?/, ""));
    }
    if (summary.length > 0) return summary.join(" ").replace(/\*\*/g, "").slice(0, maxChars);
  }
  return content
    .replace(/[#*>`|]/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxChars);
}

function toDigest(entry: CodexEntry): ClusterNoteDigest {
  return {
    id: entry.id,
    title: entry.title,
    categoryLabel: getCategory(entry.categoryKey).labelKo,
    tier: getTierInfo(entry.tier).labelKo,
    digest: noteDigest(entry.content),
  };
}

export interface RebuildResult {
  clusterCount: number;
  groupedNotes: number;
  totalNotes: number;
}

/**
 * Recomputes every learning cluster from scratch: digests all notes, asks the
 * model to group them into study units, then replaces the clusters tables.
 * Deliberately a full rebuild — clusters are a derived view, cheap to redo,
 * and a whole-library pass keeps groupings globally coherent.
 */
export async function rebuildClusters(
  caller: ClusterCaller = defaultClusterCaller()
): Promise<RebuildResult> {
  const all = await listEntries();
  const digests = all.map(toDigest);

  const result = await caller({ notes: digests });
  const timestamp = new Date().toISOString();

  db.transaction((tx) => {
    tx.delete(clusterEntries).run();
    tx.delete(clusters).run();
    for (const cluster of result) {
      const id = randomUUID();
      tx.insert(clusters)
        .values({
          id,
          title: cluster.title,
          description: cluster.description,
          suggestions: cluster.suggestions,
          createdAt: timestamp,
        })
        .run();
      tx.insert(clusterEntries)
        .values(
          cluster.entryIds.map((entryId, position) => ({ clusterId: id, entryId, position }))
        )
        .run();
    }
  });

  const grouped = new Set(result.flatMap((c) => c.entryIds)).size;
  return { clusterCount: result.length, groupedNotes: grouped, totalNotes: all.length };
}

export interface ClusterView {
  id: string;
  title: string;
  description: string;
  suggestions: string[];
  entries: CodexEntry[];
}

/** All clusters, each with its notes hydrated in study order. */
export async function listClusters(): Promise<ClusterView[]> {
  const clusterRows = await db.select().from(clusters).orderBy(asc(clusters.createdAt));
  if (clusterRows.length === 0) return [];

  const links = await db
    .select()
    .from(clusterEntries)
    .orderBy(asc(clusterEntries.clusterId), asc(clusterEntries.position));

  const entryIds = Array.from(new Set(links.map((l) => l.entryId)));
  const entryList = await Promise.all(entryIds.map((id) => getEntry(id)));
  const entryById = new Map(
    entryList.filter((e): e is CodexEntry => Boolean(e)).map((e) => [e.id, e])
  );

  const linksByCluster = new Map<string, typeof links>();
  for (const link of links) {
    if (!linksByCluster.has(link.clusterId)) linksByCluster.set(link.clusterId, []);
    linksByCluster.get(link.clusterId)!.push(link);
  }

  return clusterRows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    suggestions: row.suggestions,
    entries: (linksByCluster.get(row.id) ?? [])
      .map((l) => entryById.get(l.entryId))
      .filter((e): e is CodexEntry => Boolean(e)),
  }));
}

export interface ClusterNav {
  clusterId: string;
  clusterTitle: string;
  position: number;
  total: number;
  prev: { id: string; title: string } | null;
  next: { id: string; title: string } | null;
}

/** For a note, the cluster it belongs to and its prev/next siblings — powers
 * chunk-by-chunk study navigation on the note page. Returns null if the note
 * isn't in any cluster. */
export async function clusterNavForEntry(entryId: string): Promise<ClusterNav | null> {
  const [link] = await db
    .select()
    .from(clusterEntries)
    .where(eq(clusterEntries.entryId, entryId));
  if (!link) return null;

  const [cluster] = await db.select().from(clusters).where(eq(clusters.id, link.clusterId));
  if (!cluster) return null;

  const siblings = await db
    .select()
    .from(clusterEntries)
    .where(eq(clusterEntries.clusterId, link.clusterId))
    .orderBy(asc(clusterEntries.position));

  const idx = siblings.findIndex((s) => s.entryId === entryId);
  const titleOf = async (id: string | undefined) => {
    if (!id) return null;
    const [row] = await db.select({ title: entries.title }).from(entries).where(eq(entries.id, id));
    return row ? { id, title: row.title } : null;
  };

  return {
    clusterId: cluster.id,
    clusterTitle: cluster.title,
    position: idx,
    total: siblings.length,
    prev: await titleOf(siblings[idx - 1]?.entryId),
    next: await titleOf(siblings[idx + 1]?.entryId),
  };
}

export async function clusterCount(): Promise<number> {
  const rows = await db.select({ id: clusters.id }).from(clusters);
  return rows.length;
}

/** Remove links to entries that no longer exist (cascade already handles
 * deletes, but keeps the API explicit for callers). */
export async function pruneClusterLinks(): Promise<void> {
  const links = await db.select({ entryId: clusterEntries.entryId }).from(clusterEntries);
  const ids = Array.from(new Set(links.map((l) => l.entryId)));
  if (ids.length === 0) return;
  const existing = await db
    .select({ id: entries.id })
    .from(entries)
    .where(inArray(entries.id, ids));
  const existingSet = new Set(existing.map((e) => e.id));
  const orphans = ids.filter((id) => !existingSet.has(id));
  if (orphans.length > 0) {
    await db.delete(clusterEntries).where(inArray(clusterEntries.entryId, orphans));
  }
}
