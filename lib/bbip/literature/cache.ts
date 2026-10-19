// lib/bbip/literature/cache.ts
import { eq } from "drizzle-orm";
import { db } from "../../db/client";
import { literatureCache } from "../../db/schema";

export type LitProvider = "pubmed" | "web";

export const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function normalizeQuery(query: string): string {
  return query.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

export function cacheKey(provider: LitProvider, query: string): string {
  return `${provider}:${normalizeQuery(query)}`;
}

/** Cached results, or null when missing or older than 30 days. */
export function readCache<T>(provider: LitProvider, query: string, now = new Date()): T[] | null {
  const row = db
    .select()
    .from(literatureCache)
    .where(eq(literatureCache.key, cacheKey(provider, query)))
    .get();
  if (!row) return null;
  const age = now.getTime() - Date.parse(row.fetchedAt);
  return age >= 0 && age <= CACHE_TTL_MS ? (row.results as T[]) : null;
}

export function writeCache(provider: LitProvider, query: string, results: unknown[], now = new Date()): void {
  const fetchedAt = now.toISOString();
  db.insert(literatureCache)
    .values({ key: cacheKey(provider, query), provider, results, fetchedAt })
    .onConflictDoUpdate({ target: literatureCache.key, set: { results, fetchedAt } })
    .run();
}

/** Same search within 30 days → no provider call. Only non-empty results
 * are stored, so "nothing found" is retried next time; errors propagate
 * and are never cached. */
export async function cachedSearch<T>(
  provider: LitProvider,
  query: string,
  search: (query: string) => Promise<T[]>,
  now = new Date()
): Promise<{ results: T[]; cached: boolean }> {
  const hit = readCache<T>(provider, query, now);
  if (hit) return { results: hit, cached: true };
  const results = await search(query);
  if (results.length > 0) writeCache(provider, query, results, now);
  return { results, cached: false };
}
