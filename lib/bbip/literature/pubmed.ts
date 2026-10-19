// lib/bbip/literature/pubmed.ts
import type { PaperHit } from "../types";
import { levelFromTypes } from "./refs";

// NCBI E-utilities: esearch (relevance, top 8) → efetch (abstract XML).
// The XML is parsed with small tag regexes — the PubMed DTD is stable and
// only a handful of elements are read, so no XML dependency is needed.

const EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
export const PUBMED_RETMAX = 8;
const ABSTRACT_MAX = 2000;
const TIMEOUT_MS = 10_000;

function eutilsParams(entries: Record<string, string>, apiKey?: string): URLSearchParams {
  const params = new URLSearchParams({ db: "pubmed", ...entries, tool: "bbip" });
  if (apiKey) params.set("api_key", apiKey);
  return params;
}

export function esearchUrl(term: string, apiKey?: string): string {
  const params = eutilsParams(
    { term, retmode: "json", sort: "relevance", retmax: String(PUBMED_RETMAX) },
    apiKey
  );
  return `${EUTILS}/esearch.fcgi?${params}`;
}

export function efetchUrl(pmids: string[], apiKey?: string): string {
  const params = eutilsParams({ id: pmids.join(","), rettype: "abstract", retmode: "xml" }, apiKey);
  return `${EUTILS}/efetch.fcgi?${params}`;
}

export function parseEsearch(json: unknown): string[] {
  const ids = (json as { esearchresult?: { idlist?: unknown } } | null)?.esearchresult?.idlist;
  return Array.isArray(ids)
    ? ids.filter((id): id is string => typeof id === "string" && /^\d{1,9}$/.test(id))
    : [];
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

/** Element text → plain text: inline markup (<i>, <sup>) dropped first, then
 * entities decoded, so escaped "&lt;b&gt;" stays visible as "<b>". */
export function decodeXml(value: string): string {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
      if (entity.startsWith("#")) {
        const hex = entity[1] === "x" || entity[1] === "X";
        const code = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
        return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
      }
      return ENTITIES[entity.toLowerCase()] ?? match;
    })
    .replace(/[ \t\r\n]+/g, " ")
    .trim();
}

function elements(xml: string, tag: string): Array<{ attrs: string; body: string }> {
  const pattern = new RegExp(`<${tag}(\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "g");
  return Array.from(xml.matchAll(pattern), (m) => ({ attrs: m[1] ?? "", body: m[2] ?? "" }));
}

function first(xml: string, tag: string): string | undefined {
  return elements(xml, tag)[0]?.body;
}

function parseArticle(xml: string): PaperHit | null {
  const pmid = decodeXml(first(xml, "PMID") ?? "");
  const title = decodeXml(first(xml, "ArticleTitle") ?? "");
  if (!/^\d+$/.test(pmid) || !title) return null;
  const journalXml = first(xml, "Journal") ?? "";
  const journal = decodeXml(first(journalXml, "ISOAbbreviation") ?? first(journalXml, "Title") ?? "");
  const pubDate = first(journalXml, "PubDate") ?? "";
  const yearText = first(pubDate, "Year") ?? first(pubDate, "MedlineDate")?.match(/\d{4}/)?.[0];
  const year = yearText ? Number.parseInt(yearText, 10) : NaN;
  const authors = elements(first(xml, "AuthorList") ?? "", "Author")
    .map(({ body }) => {
      const collective = first(body, "CollectiveName");
      if (collective) return decodeXml(collective);
      return [decodeXml(first(body, "LastName") ?? ""), decodeXml(first(body, "Initials") ?? "")]
        .filter(Boolean)
        .join(" ");
    })
    .filter(Boolean);
  const abstract = elements(first(xml, "Abstract") ?? "", "AbstractText")
    .map(({ attrs, body }) => {
      const text = decodeXml(body);
      const label = /\bLabel="([^"]*)"/.exec(attrs)?.[1];
      return label && text ? `${decodeXml(label)}: ${text}` : text;
    })
    .filter(Boolean)
    .join("\n")
    .slice(0, ABSTRACT_MAX);
  const publicationTypes = elements(first(xml, "PublicationTypeList") ?? "", "PublicationType")
    .map(({ body }) => decodeXml(body))
    .filter(Boolean);
  return {
    pmid,
    title,
    authors,
    ...(year >= 1800 && year <= 2100 ? { year } : {}),
    journal,
    abstract,
    publicationTypes,
    level: levelFromTypes(publicationTypes),
  };
}

export function parsePubmedXml(xml: string): PaperHit[] {
  return elements(xml, "PubmedArticle").flatMap(({ body }) => {
    const paper = parseArticle(body);
    return paper ? [paper] : [];
  });
}

export interface RateLimiter {
  wait(): Promise<void>;
}

export interface Clock {
  now(): number;
  sleep(ms: number): Promise<void>;
}

const realClock: Clock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

/** Reserves evenly spaced slots: NCBI allows 3 req/s without a key, 10 with. */
export function createRateLimiter(perSecond: number, clock: Clock = realClock): RateLimiter {
  const interval = Math.ceil(1000 / perSecond);
  let next = 0;
  return {
    async wait() {
      const now = clock.now();
      const at = Math.max(now, next);
      next = at + interval;
      if (at > now) await clock.sleep(at - now);
    },
  };
}

declare global {
  // eslint-disable-next-line no-var
  var __bbipPubmedLimiter: RateLimiter | undefined;
}

export interface PubMedDeps {
  fetch: (url: string, init?: RequestInit) => Promise<Response>;
  limiter: RateLimiter;
  apiKey?: string;
}

function defaultPubMedDeps(): PubMedDeps {
  const apiKey = process.env.NCBI_API_KEY || undefined;
  // One limiter per process (route modules are bundled separately).
  const limiter = (globalThis.__bbipPubmedLimiter ??= createRateLimiter(apiKey ? 10 : 3));
  return { fetch: (url, init) => fetch(url, init), limiter, apiKey };
}

export async function searchPubMed(query: string, deps: PubMedDeps = defaultPubMedDeps()): Promise<PaperHit[]> {
  await deps.limiter.wait();
  const search = await deps.fetch(esearchUrl(query, deps.apiKey), { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!search.ok) throw new Error(`PubMed esearch HTTP ${search.status}`);
  const pmids = parseEsearch(await search.json());
  if (pmids.length === 0) return [];
  await deps.limiter.wait();
  const fetched = await deps.fetch(efetchUrl(pmids, deps.apiKey), { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!fetched.ok) throw new Error(`PubMed efetch HTTP ${fetched.status}`);
  const rank = new Map(pmids.map((id, index) => [id, index]));
  return parsePubmedXml(await fetched.text()).sort(
    (a, b) => (rank.get(a.pmid) ?? pmids.length) - (rank.get(b.pmid) ?? pmids.length)
  );
}

/** CODEX_AI_MODE=fake: deterministic papers, no network. */
export function fakePapers(query: string): PaperHit[] {
  const topic = query.replace(/["[\]]/g, "").slice(0, 80) || "aesthetic procedure";
  return [
    {
      pmid: "10000001",
      title: `[FAKE] Systematic review: ${topic}`,
      authors: ["Fake A", "Demo B"],
      year: 2025,
      journal: "Fake J Dermatol",
      abstract: "FAKE 모드 예시 초록입니다. 실제 모드에서는 PubMed 초록이 표시됩니다.",
      publicationTypes: ["Systematic Review"],
      level: "meta",
    },
    {
      pmid: "10000002",
      title: `[FAKE] Randomized trial: ${topic}`,
      authors: ["Demo C"],
      year: 2024,
      journal: "Fake Dermatol Surg",
      abstract: "FAKE 모드 예시 초록입니다.",
      publicationTypes: ["Randomized Controlled Trial"],
      level: "rct",
    },
  ];
}
