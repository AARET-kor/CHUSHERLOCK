// lib/bbip/literature/web.ts
import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient, MID_MODEL } from "../../ai/client";
import { supportsEffort } from "../models";
import type { WebHit } from "../types";

// Claude's web search server tool, restricted to medical domains. Hits are
// read from the web_search_tool_result blocks (URL/title as returned by the
// search engine) — never from the model's prose — so a W# link cannot be
// invented. Snippets come from the model's web_search_result_location
// citations.

export const DEFAULT_WEB_DOMAINS = [
  "pubmed.ncbi.nlm.nih.gov",
  "ncbi.nlm.nih.gov",
  "nih.gov",
  "jaad.org",
  "onlinelibrary.wiley.com",
  "link.springer.com",
  "academic.oup.com",
  "journals.lww.com",
  "mfds.go.kr",
  "nedrug.mfds.go.kr",
  "fda.gov",
];

const HOST = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;
const MAX_HITS = 6;
const SNIPPET_MAX = 400;
const MAX_CONTINUATIONS = 3;
const WEB_TIMEOUT_MS = 60_000;

/** BBIP_WEB_DOMAINS (comma/space separated) overrides the default list. */
export function webDomains(value: string | undefined = process.env.BBIP_WEB_DOMAINS): string[] {
  const list = (value ?? "")
    .split(/[,\s]+/)
    .map((domain) => domain.trim().toLowerCase())
    .filter((domain) => HOST.test(domain));
  return list.length > 0 ? Array.from(new Set(list)).slice(0, 64) : DEFAULT_WEB_DOMAINS;
}

export const WEB_MODEL = process.env.BBIP_WEB_MODEL ?? MID_MODEL;

/** The dynamic-filtering variant needs Opus/Sonnet 4.6+; older models get the basic tool. */
export function webSearchToolType(model: string): "web_search_20260209" | "web_search_20250305" {
  return /^claude-(?:opus-(?:5|4-[6-9])|sonnet-(?:5|4-6)|fable-5|mythos-5)/.test(model)
    ? "web_search_20260209"
    : "web_search_20250305";
}

export function buildWebPrompt(query: string): string {
  return `Find clinical evidence for this aesthetic-medicine question: ${query}

Search the allowed medical sources (clinical guidelines, regulatory drug/device labels, peer-reviewed journals). Then list up to 5 of the most relevant sources, one line each, quoting each source's key finding. Do not add anything that is not in the search results.`;
}

export function buildWebParams(
  query: string,
  model: string,
  domains: string[],
  paused: Anthropic.ContentBlock[] = []
): Anthropic.MessageCreateParamsNonStreaming {
  const tool: Anthropic.ToolUnion =
    webSearchToolType(model) === "web_search_20260209"
      ? { type: "web_search_20260209", name: "web_search", max_uses: 3, allowed_domains: domains }
      : { type: "web_search_20250305", name: "web_search", max_uses: 3, allowed_domains: domains };
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: buildWebPrompt(query) }];
  // pause_turn: resend the paused assistant turn as-is; the server resumes.
  if (paused.length > 0) messages.push({ role: "assistant", content: paused as Anthropic.ContentBlockParam[] });
  return {
    model,
    max_tokens: 4000,
    ...(supportsEffort(model) ? { output_config: { effort: "low" as const } } : {}),
    tools: [tool],
    messages,
  };
}

function allowedUrl(url: string, domains: string[]): boolean {
  try {
    const { protocol, hostname } = new URL(url);
    if (protocol !== "https:" && protocol !== "http:") return false;
    const host = hostname.toLowerCase();
    return domains.some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

export function extractWebHits(
  content: Anthropic.ContentBlock[],
  domains: string[]
): { hits: WebHit[]; errors: string[] } {
  const snippets = new Map<string, string>();
  for (const block of content) {
    if (block.type !== "text") continue;
    for (const citation of block.citations ?? []) {
      if (citation.type === "web_search_result_location" && !snippets.has(citation.url)) {
        snippets.set(citation.url, citation.cited_text.replace(/\s+/g, " ").trim().slice(0, SNIPPET_MAX));
      }
    }
  }
  const hits = new Map<string, WebHit>();
  const errors: string[] = [];
  for (const block of content) {
    if (block.type !== "web_search_tool_result") continue;
    if (!Array.isArray(block.content)) {
      errors.push(block.content.error_code);
      continue;
    }
    for (const result of block.content) {
      if (hits.has(result.url) || !allowedUrl(result.url, domains)) continue;
      hits.set(result.url, {
        url: result.url,
        title: result.title.replace(/\s+/g, " ").trim() || result.url,
        snippet: snippets.get(result.url) ?? "",
      });
    }
  }
  const ordered = Array.from(hits.values()).sort((a, b) => Number(!a.snippet) - Number(!b.snippet));
  return { hits: ordered.slice(0, MAX_HITS), errors };
}

export type WebCreate = (
  params: Anthropic.MessageCreateParamsNonStreaming
) => Promise<Pick<Anthropic.Message, "content" | "stop_reason">>;

export interface WebDeps {
  create: WebCreate;
  model: string;
  domains: string[];
}

function defaultWebDeps(): WebDeps {
  return {
    create: (params) => getAnthropicClient().messages.create(params, { timeout: WEB_TIMEOUT_MS }),
    model: WEB_MODEL,
    domains: webDomains(),
  };
}

export async function searchWeb(query: string, deps: WebDeps = defaultWebDeps()): Promise<WebHit[]> {
  const content: Anthropic.ContentBlock[] = [];
  for (let attempt = 0; attempt <= MAX_CONTINUATIONS; attempt++) {
    const response = await deps.create(buildWebParams(query, deps.model, deps.domains, content));
    content.push(...response.content);
    if (response.stop_reason === "refusal") throw new Error("web search refused");
    if (response.stop_reason !== "pause_turn") break;
  }
  const { hits, errors } = extractWebHits(content, deps.domains);
  if (hits.length === 0 && errors.length > 0) throw new Error(`web search failed: ${errors[0]}`);
  return hits;
}

/** CODEX_AI_MODE=fake: one deterministic hit, no network. */
export function fakeWebHits(query: string): WebHit[] {
  return [
    {
      url: "https://www.fda.gov/medical-devices",
      title: `[FAKE] Regulatory overview — ${query.slice(0, 80)}`,
      snippet: "FAKE 모드 예시 웹 문서입니다.",
    },
  ];
}
