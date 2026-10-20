// lib/bbip/literature/runLiterature.ts
import { createHash } from "node:crypto";
import { isFakeMode } from "../../ai/client";
import { failTurn, getSession, setSessionLiterature, startTurn } from "../../services/bbipService";
import { runTurn } from "../runTurn";
import type { LiteratureBlock, PaperHit, ParsedCase, StreamEvent, TurnRequest, WebHit } from "../types";
import { cachedSearch } from "./cache";
import { PUBMED_RETMAX, fakePapers, searchPubMed } from "./pubmed";
import { buildLiteratureQuery, type LitQuery } from "./query";
import { fakeWebHits, searchWeb, webDomains } from "./web";

export interface LiteratureDeps {
  query: (chips: ParsedCase) => Promise<{ query: LitQuery }>;
  pubmed: (query: string) => Promise<PaperHit[]>;
  web: (query: string) => Promise<WebHit[]>;
  /** Generates the 문헌 근거 card once the block is on the session. */
  runTurn: (sessionId: string, request: TurnRequest) => AsyncIterable<StreamEvent>;
  now: () => Date;
  /** false in fake mode: canned results must never land in (or come from)
   * the cache real searches use. Default true. */
  useCache?: boolean;
  /** Cache key variant for web results — the allowed-domain list. */
  webVariant?: string;
}

/** Short, stable id of the web domain allow-list. */
export function domainsVariant(domains: string[]): string {
  return createHash("sha1").update([...domains].sort().join(",")).digest("hex").slice(0, 10);
}

function defaultDeps(): LiteratureDeps {
  const fake = isFakeMode();
  return {
    query: (chips) => buildLiteratureQuery(chips),
    pubmed: fake ? async (query) => fakePapers(query) : (query) => searchPubMed(query),
    web: fake ? async (query) => fakeWebHits(query) : (query) => searchWeb(query),
    runTurn: (sessionId, request) => runTurn(sessionId, request),
    now: () => new Date(),
    useCache: !fake,
    webVariant: domainsVariant(webDomains()),
  };
}

export const NOT_FOUND = "문헌을 찾지 못했습니다.";
const PROVIDER_FAILED = { pubmed: "PubMed 검색에 실패했습니다.", web: "웹 검색에 실패했습니다." } as const;

/** Query → PubMed and web in parallel (each cached). One provider failing
 * leaves an error note; the other's results still count. */
export async function searchLiterature(chips: ParsedCase, deps: LiteratureDeps): Promise<LiteratureBlock> {
  const { query } = await deps.query(chips);
  const now = deps.now();
  const none = Promise.resolve({ results: [] as never[], cached: false });
  const search = <T>(provider: "pubmed" | "web", q: string, run: (q: string) => Promise<T[]>, variant = "") =>
    deps.useCache === false
      ? run(q).then((results) => ({ results, cached: false }))
      : cachedSearch(provider, q, run, now, variant);
  const [pubmed, web] = await Promise.allSettled([
    query.pubmed ? search("pubmed", query.pubmed, deps.pubmed) : none,
    query.web ? search("web", query.web, deps.web, deps.webVariant) : none,
  ]);
  const errors: LiteratureBlock["errors"] = {};
  if (pubmed.status === "rejected") {
    console.warn("[bbip] pubmed search failed:", pubmed.reason instanceof Error ? pubmed.reason.message : "unknown");
    errors.pubmed = PROVIDER_FAILED.pubmed;
  }
  if (web.status === "rejected") {
    console.warn("[bbip] web search failed:", web.reason instanceof Error ? web.reason.message : "unknown");
    errors.web = PROVIDER_FAILED.web;
  }
  return {
    pubmedQuery: query.pubmed,
    webQuery: query.web,
    papers: pubmed.status === "fulfilled" ? pubmed.value.results.slice(0, PUBMED_RETMAX) : [],
    web: web.status === "fulfilled" ? web.value.results : [],
    errors,
    fetchedAt: now.toISOString(),
  };
}

export const MAX_PAPERS = 30;
export const MAX_WEB = 20;

function urlKey(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host.toLowerCase()}${u.pathname.replace(/\/+$/, "")}${u.search}`;
  } catch {
    return url.trim().toLowerCase();
  }
}

/** [P#]/[W#] are positions in the session block, and earlier cards (and
 * notes promoted from them) keep pointing at them. So a re-search never
 * reorders or drops a source: new ones are appended, up to the caps.
 * Queries, errors and fetchedAt describe the latest search. */
export function mergeLiterature(prev: LiteratureBlock | undefined, next: LiteratureBlock): LiteratureBlock {
  if (!prev) return next;
  const pmids = new Set(prev.papers.map((paper) => paper.pmid));
  const urls = new Set(prev.web.map((hit) => urlKey(hit.url)));
  const papers = [...prev.papers];
  for (const paper of next.papers) {
    if (papers.length >= MAX_PAPERS) break;
    if (pmids.has(paper.pmid)) continue;
    pmids.add(paper.pmid);
    papers.push(paper);
  }
  const web = [...prev.web];
  for (const hit of next.web) {
    if (web.length >= MAX_WEB) break;
    const key = urlKey(hit.url);
    if (urls.has(key)) continue;
    urls.add(key);
    web.push(hit);
  }
  return { ...next, papers, web };
}

export function noLiteratureText(block: LiteratureBlock): string {
  const lines = [
    `> **주의** ${NOT_FOUND}`,
    "",
    `- PubMed 검색어: \`${block.pubmedQuery || "(없음)"}\``,
    `- 웹 검색어: \`${block.webQuery || "(없음)"}\``,
  ];
  if (block.errors.pubmed) lines.push(`- ${block.errors.pubmed}`);
  if (block.errors.web) lines.push(`- ${block.errors.web}`);
  lines.push("", "시술·질환 칩을 더 구체적으로 바꾸거나 잠시 후 다시 시도해 보세요.");
  return lines.join("\n");
}

/** 🔬 문헌 근거 찾기: search, attach the block to the session (so later
 * cards can cite it), then stream the literature card through runTurn. */
export async function* runLiterature(
  sessionId: string,
  deps: LiteratureDeps = defaultDeps()
): AsyncGenerator<StreamEvent> {
  const session = getSession(sessionId);
  if (!session) {
    yield { type: "error", message: "세션을 찾을 수 없습니다." };
    return;
  }
  let block: LiteratureBlock;
  let merged: LiteratureBlock;
  try {
    block = await searchLiterature(session.chips, deps);
    merged = mergeLiterature(session.literature, block);
    setSessionLiterature(sessionId, merged);
  } catch (error) {
    console.error("[bbip] literature search failed:", error);
    yield { type: "error", message: "문헌 검색에 실패했습니다." };
    return;
  }
  yield { type: "literature", block: merged };

  // "Nothing found" is about this search, even if earlier sources remain.
  if (block.papers.length === 0 && block.web.length === 0) {
    // Stored as failed: the card shows the queries and offers 다시 시도,
    // and an empty result can never be promoted to a note.
    const turn = startTurn(sessionId, { kind: "literature" }, "none");
    const text = noLiteratureText(block);
    yield { type: "start", turnId: turn.id };
    yield { type: "delta", text };
    failTurn(turn.id, text, NOT_FOUND);
    yield { type: "error", message: NOT_FOUND };
    return;
  }
  yield* deps.runTurn(sessionId, { kind: "literature" });
}
