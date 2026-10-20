// tests/bbip-lit-cache.test.ts
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { setupTempDb } from "./helpers/tempDb";

let env: Awaited<ReturnType<typeof setupTempDb>>;
let cache: typeof import("../lib/bbip/literature/cache");

beforeAll(async () => {
  env = await setupTempDb("bbip-lit-cache");
  cache = await import("../lib/bbip/literature/cache");
});
afterAll(() => env.cleanup());

const DAY = 24 * 60 * 60 * 1000;

describe("literature cache", () => {
  it("normalizes keys by provider and query", () => {
    expect(cache.normalizeQuery("  Melasma\tAND  ＰＩＣＯ ")).toBe("melasma and pico");
    expect(cache.cacheKey("pubmed", "Melasma  laser")).toBe("pubmed:melasma laser");
    expect(cache.cacheKey("web", "Melasma laser")).not.toBe(cache.cacheKey("pubmed", "Melasma laser"));
  });

  it("keeps a variant (e.g. the web domain list) in its own key space", async () => {
    expect(cache.cacheKey("web", "q", "abc")).not.toBe(cache.cacheKey("web", "q"));
    expect(cache.cacheKey("web", "q", "abc")).not.toBe(cache.cacheKey("web", "q", "def"));
    const search = vi.fn(async () => [{ id: 1 }]);
    await cache.cachedSearch("web", "variant-q", search, undefined, "abc");
    await cache.cachedSearch("web", "variant-q", search, undefined, "def");
    await cache.cachedSearch("web", "variant-q", search, undefined, "abc");
    expect(search).toHaveBeenCalledTimes(2);
  });

  it("serves a hit without calling the provider, and refetches after 30 days", async () => {
    const t0 = new Date("2026-10-01T00:00:00.000Z");
    const search = vi.fn(async () => [{ id: 1 }]);
    expect(await cache.cachedSearch("pubmed", "q1", search, t0)).toEqual({ results: [{ id: 1 }], cached: false });
    expect(await cache.cachedSearch("pubmed", " Q1 ", search, new Date(t0.getTime() + 29 * DAY))).toEqual({
      results: [{ id: 1 }],
      cached: true,
    });
    expect(search).toHaveBeenCalledTimes(1);
    search.mockResolvedValueOnce([{ id: 2 }]);
    const later = new Date(t0.getTime() + 31 * DAY);
    expect(await cache.cachedSearch("pubmed", "q1", search, later)).toEqual({ results: [{ id: 2 }], cached: false });
    expect(cache.readCache("pubmed", "q1", later)).toEqual([{ id: 2 }]);
  });

  it("does not cache empty results or errors", async () => {
    const empty = vi.fn(async () => []);
    await cache.cachedSearch("web", "nothing", empty);
    await cache.cachedSearch("web", "nothing", empty);
    expect(empty).toHaveBeenCalledTimes(2);
    const failing = vi.fn(async () => {
      throw new Error("down");
    });
    await expect(cache.cachedSearch("web", "boom", failing)).rejects.toThrow("down");
    expect(cache.readCache("web", "boom")).toBeNull();
  });
});
