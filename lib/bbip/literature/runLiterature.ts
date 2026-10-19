// lib/bbip/literature/runLiterature.ts
import { isFakeMode } from "../../ai/client";
import { failTurn, getSession, setSessionLiterature, startTurn } from "../../services/bbipService";
import { runTurn } from "../runTurn";
import type { LiteratureBlock, PaperHit, ParsedCase, StreamEvent, TurnRequest, WebHit } from "../types";
import { cachedSearch } from "./cache";
import { PUBMED_RETMAX, fakePapers, searchPubMed } from "./pubmed";
import { buildLiteratureQuery, type LitQuery } from "./query";
import { fakeWebHits, searchWeb } from "./web";

export interface LiteratureDeps {
  query: (chips: ParsedCase) => Promise<{ query: LitQuery }>;
  pubmed: (query: string) => Promise<PaperHit[]>;
  web: (query: string) => Promise<WebHit[]>;
  /** Generates the 문헌 근거 card once the block is on the session. */
  runTurn: (sessionId: string, request: TurnRequest) => AsyncIterable<StreamEvent>;
  now: () => Date;
}

function defaultDeps(): LiteratureDeps {
  const fake = isFakeMode();
  return {
    query: (chips) => buildLiteratureQuery(chips),
    pubmed: fake ? async (query) => fakePapers(query) : (query) => searchPubMed(query),
    web: fake ? async (query) => fakeWebHits(query) : (query) => searchWeb(query),
    runTurn: (sessionId, request) => runTurn(sessionId, request),
    now: () => new Date(),
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
  const [pubmed, web] = await Promise.allSettled([
    query.pubmed ? cachedSearch("pubmed", query.pubmed, deps.pubmed, now) : none,
    query.web ? cachedSearch("web", query.web, deps.web, now) : none,
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
  try {
    block = await searchLiterature(session.chips, deps);
    setSessionLiterature(sessionId, block);
  } catch (error) {
    console.error("[bbip] literature search failed:", error);
    yield { type: "error", message: "문헌 검색에 실패했습니다." };
    return;
  }
  yield { type: "literature", block };

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
