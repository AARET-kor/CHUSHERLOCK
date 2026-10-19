// tests/bbip-lit-query.test.ts
import { describe, expect, it, vi } from "vitest";
import {
  buildLiteratureQuery,
  buildQueryPrompt,
  fallbackQuery,
  sanitizeLitQuery,
} from "../lib/bbip/literature/query";

const chips = { patient: ["40대 여성"], conditions: ["기미"], meds: ["아스피린"], procedures: ["피코토닝"] };

describe("fallbackQuery", () => {
  it("translates known Korean chips into an English AND query", () => {
    expect(fallbackQuery(chips)).toEqual({
      pubmed: '"picosecond laser" AND "Melasma"',
      web: "picosecond laser Melasma Aspirin",
    });
  });

  it("uses meds when there is no condition, keeps ASCII chips, drops unknown Korean", () => {
    expect(
      fallbackQuery({ patient: [], conditions: ["알수없음"], meds: ["tretinoin"], procedures: ["필러", "보톡스"] })
    ).toEqual({
      pubmed: '("Dermal Fillers" OR "Botulinum Toxins, Type A") AND "tretinoin"',
      web: "Dermal Fillers Botulinum Toxins, Type A tretinoin",
    });
    expect(fallbackQuery({ patient: [], conditions: ["알수없음"], meds: [], procedures: [] })).toEqual({
      pubmed: "",
      web: "",
    });
  });
});

describe("prompt and sanitizing", () => {
  it("never sends patient chips", () => {
    const prompt = buildQueryPrompt(chips);
    expect(prompt).toContain("피코토닝");
    expect(prompt).toContain("MeSH");
    expect(prompt).not.toContain("40대 여성");
  });

  it("strips markup, backticks and control characters, and bounds length", () => {
    expect(sanitizeLitQuery({ pubmed: "a <b> `c`\u0000  d", web: "x".repeat(400) })).toEqual({
      pubmed: "a b c d",
      web: "x".repeat(150),
    });
  });
});

describe("buildLiteratureQuery", () => {
  it("uses the model query when valid", async () => {
    const caller = vi.fn(async () => ({ pubmed: '"Melanosis"[MeSH Terms] AND picosecond[tiab]', web: "melasma picosecond laser" }));
    expect(await buildLiteratureQuery(chips, caller)).toEqual({
      query: { pubmed: '"Melanosis"[MeSH Terms] AND picosecond[tiab]', web: "melasma picosecond laser" },
      degraded: false,
    });
  });

  it("falls back on failure or an empty model query", async () => {
    const failing = vi.fn(async () => {
      throw new Error("timeout");
    });
    expect(await buildLiteratureQuery(chips, failing)).toEqual({ query: fallbackQuery(chips), degraded: true });
    const empty = vi.fn(async () => ({ pubmed: " ", web: "" }));
    expect(await buildLiteratureQuery(chips, empty)).toEqual({ query: fallbackQuery(chips), degraded: true });
  });
});
