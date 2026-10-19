// tests/bbip-lit-pubmed.test.ts
import fs from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  createRateLimiter,
  decodeXml,
  efetchUrl,
  esearchUrl,
  parseEsearch,
  parsePubmedXml,
  searchPubMed,
} from "../lib/bbip/literature/pubmed";

const fixture = (name: string) => fs.readFileSync(new URL(`./fixtures/pubmed/${name}`, import.meta.url), "utf8");
const esearchJson = JSON.parse(fixture("esearch-melasma.json"));
const efetchXml = fixture("efetch-melasma.xml");

describe("E-utilities URLs", () => {
  it("builds esearch/efetch URLs with optional api key", () => {
    const url = new URL(esearchUrl('"Melanosis"[MeSH Terms] AND picosecond'));
    expect(url.origin + url.pathname).toBe("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi");
    expect(url.searchParams.get("db")).toBe("pubmed");
    expect(url.searchParams.get("sort")).toBe("relevance");
    expect(url.searchParams.get("retmax")).toBe("8");
    expect(url.searchParams.get("retmode")).toBe("json");
    expect(url.searchParams.get("term")).toBe('"Melanosis"[MeSH Terms] AND picosecond');
    expect(url.searchParams.has("api_key")).toBe(false);
    const fetchUrl = new URL(efetchUrl(["1", "2"], "KEY"));
    expect(fetchUrl.searchParams.get("id")).toBe("1,2");
    expect(fetchUrl.searchParams.get("rettype")).toBe("abstract");
    expect(fetchUrl.searchParams.get("retmode")).toBe("xml");
    expect(fetchUrl.searchParams.get("api_key")).toBe("KEY");
  });

  it("reads PMIDs from esearch JSON and ignores junk", () => {
    expect(parseEsearch(esearchJson)).toEqual(["38000003", "38000001", "38000002"]);
    expect(parseEsearch({ esearchresult: { idlist: ["12", "x", 3] } })).toEqual(["12"]);
    expect(parseEsearch(null)).toEqual([]);
  });
});

describe("parsePubmedXml", () => {
  const papers = parsePubmedXml(efetchXml);

  it("parses every article with authors, year, journal and level", () => {
    expect(papers.map((p) => [p.pmid, p.year, p.journal, p.level])).toEqual([
      ["38000001", 2024, "J Am Acad Dermatol", "meta"],
      ["38000002", 2023, "Dermatologic Surgery", "rct"],
      ["38000003", 2022, "J Cosmet Dermatol", "case"],
    ]);
    expect(papers[0]!.authors).toEqual(["Kim J", "Lee S", "Park H", "Choi Y"]);
    expect(papers[1]!.authors).toEqual(["Korean Laser Study Group"]);
    expect(papers[2]!.abstract).toBe("");
  });

  it("decodes entities, strips inline markup and keeps abstract labels", () => {
    expect(papers[0]!.title).toBe(
      "Picosecond laser for melasma: a systematic review & meta-analysis of randomized trials."
    );
    expect(papers[0]!.abstract).toBe(
      "BACKGROUND: Melasma is a chronic, relapsing hyperpigmentation.\nRESULTS: Twelve trials (n = 640) showed MASI reduction > 30% with 1064-nm picosecond toning."
    );
    expect(papers[1]!.abstract).toBe("Forty patients – Fitzpatrick III–IV – were randomized.");
    expect(papers[0]!.publicationTypes).toEqual(["Journal Article", "Meta-Analysis", "Systematic Review"]);
  });

  it("decodeXml leaves escaped markup as text", () => {
    expect(decodeXml("a &lt;b&gt; <sup>2</sup> &unknown; &#65;")).toBe("a <b> 2 &unknown; A");
  });
});

describe("searchPubMed", () => {
  it("runs esearch then efetch and keeps relevance order", async () => {
    const fetch = vi.fn(async (url: string) =>
      url.includes("esearch.fcgi") ? Response.json(esearchJson) : new Response(efetchXml)
    );
    const limiter = { wait: vi.fn(async () => {}) };
    const papers = await searchPubMed("melasma", { fetch, limiter, apiKey: "K" });
    expect(papers.map((p) => p.pmid)).toEqual(["38000003", "38000001", "38000002"]);
    expect(limiter.wait).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[1]![0]).toContain("id=38000003%2C38000001%2C38000002");
    expect(fetch.mock.calls[0]![0]).toContain("api_key=K");
  });

  it("returns [] without efetch when nothing matches, throws on HTTP errors", async () => {
    const empty = vi.fn(async () => Response.json({ esearchresult: { idlist: [] } }));
    expect(await searchPubMed("x", { fetch: empty, limiter: { wait: async () => {} } })).toEqual([]);
    expect(empty).toHaveBeenCalledTimes(1);
    const down = vi.fn(async () => new Response("busy", { status: 429 }));
    await expect(searchPubMed("x", { fetch: down, limiter: { wait: async () => {} } })).rejects.toThrow("429");
  });
});

describe("createRateLimiter", () => {
  it("spaces calls to the per-second budget", async () => {
    let now = 1000;
    const sleeps: number[] = [];
    const limiter = createRateLimiter(3, {
      now: () => now,
      sleep: async (ms) => {
        sleeps.push(ms);
        now += ms;
      },
    });
    await limiter.wait();
    await limiter.wait();
    await limiter.wait();
    expect(sleeps).toEqual([334, 334]);
    now += 2000;
    await limiter.wait();
    expect(sleeps).toHaveLength(2);
  });
});
