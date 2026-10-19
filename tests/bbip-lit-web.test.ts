// tests/bbip-lit-web.test.ts
import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import {
  buildWebParams,
  DEFAULT_WEB_DOMAINS,
  extractWebHits,
  searchWeb,
  webDomains,
  webSearchToolType,
} from "../lib/bbip/literature/web";

const domains = ["fda.gov", "ncbi.nlm.nih.gov"];

function searchResult(results: Array<{ url: string; title: string }>): Anthropic.ContentBlock {
  return {
    type: "web_search_tool_result",
    tool_use_id: "srv_1",
    caller: { type: "direct" },
    content: results.map((r) => ({ type: "web_search_result", encrypted_content: "x", page_age: null, ...r })),
  } as unknown as Anthropic.ContentBlock;
}

function citedText(url: string, cited: string): Anthropic.ContentBlock {
  return {
    type: "text",
    text: "summary",
    citations: [{ type: "web_search_result_location", url, title: "t", cited_text: cited, encrypted_index: "i" }],
  } as unknown as Anthropic.ContentBlock;
}

describe("webDomains", () => {
  it("defaults to the medical allow-list and accepts a valid override", () => {
    expect(webDomains(undefined)).toEqual(DEFAULT_WEB_DOMAINS);
    expect(DEFAULT_WEB_DOMAINS).toContain("pubmed.ncbi.nlm.nih.gov");
    expect(DEFAULT_WEB_DOMAINS).toContain("nedrug.mfds.go.kr");
    expect(webDomains(" FDA.gov, jaad.org ,, not a domain, localhost")).toEqual(["fda.gov", "jaad.org"]);
    expect(webDomains("   ")).toEqual(DEFAULT_WEB_DOMAINS);
  });
});

describe("buildWebParams", () => {
  it("uses web_search_20260209 with allowed_domains on 5.5 models", () => {
    expect(webSearchToolType("claude-sonnet-5-5")).toBe("web_search_20260209");
    expect(webSearchToolType("claude-opus-4-6")).toBe("web_search_20260209");
    expect(webSearchToolType("claude-haiku-4-5")).toBe("web_search_20250305");
    const params = buildWebParams("melasma picosecond", "claude-sonnet-5-5", domains);
    expect(params.tools).toEqual([
      { type: "web_search_20260209", name: "web_search", max_uses: 3, allowed_domains: domains },
    ]);
    expect(params.output_config).toEqual({ effort: "low" });
    expect(JSON.stringify(params.messages)).toContain("melasma picosecond");
  });
});

describe("extractWebHits", () => {
  it("takes URLs from search results only, cited first, inside allowed domains", () => {
    const { hits, errors } = extractWebHits(
      [
        searchResult([
          { url: "https://www.fda.gov/a", title: "FDA label" },
          { url: "https://evil.example.com/x", title: "Not allowed" },
          { url: "https://pubmed.ncbi.nlm.nih.gov/1/", title: "Paper" },
          { url: "https://www.fda.gov/a", title: "dup" },
        ]),
        citedText("https://pubmed.ncbi.nlm.nih.gov/1/", "  key   finding  "),
        citedText("https://made-up.example.org/", "hallucinated"),
      ],
      domains
    );
    expect(errors).toEqual([]);
    expect(hits).toEqual([
      { url: "https://pubmed.ncbi.nlm.nih.gov/1/", title: "Paper", snippet: "key finding" },
      { url: "https://www.fda.gov/a", title: "FDA label", snippet: "" },
    ]);
  });

  it("reports tool errors", () => {
    const error = {
      type: "web_search_tool_result",
      tool_use_id: "srv",
      caller: { type: "direct" },
      content: { type: "web_search_tool_result_error", error_code: "too_many_requests" },
    } as unknown as Anthropic.ContentBlock;
    expect(extractWebHits([error], domains)).toEqual({ hits: [], errors: ["too_many_requests"] });
  });
});

describe("searchWeb", () => {
  it("resumes pause_turn with the paused assistant content", async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce({ stop_reason: "pause_turn", content: [searchResult([{ url: "https://fda.gov/1", title: "One" }])] })
      .mockResolvedValueOnce({ stop_reason: "end_turn", content: [citedText("https://fda.gov/1", "label text")] });
    const hits = await searchWeb("q", { create, model: "claude-sonnet-5-5", domains });
    expect(hits).toEqual([{ url: "https://fda.gov/1", title: "One", snippet: "label text" }]);
    const second = create.mock.calls[1]![0] as Anthropic.MessageCreateParamsNonStreaming;
    expect(second.messages).toHaveLength(2);
    expect(second.messages[1]!.role).toBe("assistant");
  });

  it("throws when the search only errored or the model refused", async () => {
    const errorOnly = vi.fn().mockResolvedValue({
      stop_reason: "end_turn",
      content: [
        {
          type: "web_search_tool_result",
          tool_use_id: "s",
          caller: { type: "direct" },
          content: { type: "web_search_tool_result_error", error_code: "unavailable" },
        },
      ],
    });
    await expect(searchWeb("q", { create: errorOnly, model: "m", domains })).rejects.toThrow("unavailable");
    const refused = vi.fn().mockResolvedValue({ stop_reason: "refusal", content: [] });
    await expect(searchWeb("q", { create: refused, model: "m", domains })).rejects.toThrow("refused");
  });
});
