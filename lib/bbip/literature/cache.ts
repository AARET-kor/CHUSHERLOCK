// lib/bbip/literature/cache.ts
import { eq } from "drizzle-orm";
import { db } from "../../db/client";
import { literatureCache } from "../../db/schema";

export type LitProvider = "pubmed" | "web";

export const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function normalizeQuery(query: string): string {
  return query.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

/** `variant` separates results that depend on more than the query (the web
 * provider's domain list); without one the key format is unchanged. */
export function cacheKey(provider: LitProvider, query: string, variant = ""): string {
  return variant ? `${provider}@${variant}:${normalizeQuery(query)}` : `${provider}:${normalizeQuery(query)}`;
}

/** Cached results, or null when missing or older than 30 days. */
export function readCache<T>(provider: LitProvider, query: string, now = new Date(), variant = ""): T[] | null {
  const row = db
    .select()
    .from(literatureCache)
    .where(eq(literatureCache.key, cacheKey(provider, query, variant)))
    .get();
  if (!row) return null;
  const age = now.getTime() - Date.parse(row.fetchedAt);
  return age >= 0 && age <= CACHE_TTL_MS ? (row.results as T[]) : null;
}

export function writeCache(
  provider: LitProvider,
  query: string,
  results: unknown[],
  now = new Date(),
  variant = ""
): void {
  const fetchedAt = now.toISOString();
  db.insert(literatureCache)
    .values({ key: cacheKey(provider, query, variant), provider, results, fetchedAt })
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
  now = new Date(),
  variant = ""
): Promise<{ results: T[]; cached: boolean }> {
  const hit = readCache<T>(provider, query, now, variant);
  if (hit) return { results: hit, cached: true };
  const results = await search(query);
  if (results.length > 0) writeCache(provider, query, results, now, variant);
  return { results, cached: false };
}
