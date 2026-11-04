// tests/papers-fulltext.test.ts
import { describe, expect, it } from "vitest";
import { createRateLimiter } from "../lib/bbip/literature/pubmed";
import { capText, fetchFullText, parsePmcBody } from "../lib/papers/fulltext";

const long = "This rat model has different skin characteristics. ".repeat(20);
const xml = `<article><front><article-title>T</article-title></front><body>
<sec><title>Discussion</title><p>${long}<xref ref-type="bibr">14</xref></p>
<table-wrap><table><tr><td>TABLE CELL</td></tr></table></table-wrap>
<fig><caption>FIGURE CAPTION</caption></fig></sec></body><back><ref-list>REFERENCES</ref-list></back></article>`;

describe("parsePmcBody", () => {
  it("returns body text without tables, figures or references", () => {
    const text = parsePmcBody(xml)!;
    expect(text).toContain("Discussion");
    expect(text).toContain("different skin characteristics");
    expect(text).not.toMatch(/TABLE CELL|FIGURE CAPTION|REFERENCES|<xref/);
  });

  it("returns null when there is no usable body", () => {
    expect(parsePmcBody("<article><front/></article>")).toBeNull();
    expect(parsePmcBody("<article><body><p>short</p></body></article>")).toBeNull();
  });
});

describe("capText", () => {
  it("keeps the head and the tail, where limitations usually sit", () => {
    const capped = capText(`HEAD${"x".repeat(200)}TAIL`, 100);
    expect(capped.startsWith("HEAD")).toBe(true);
    expect(capped.endsWith("TAIL")).toBe(true);
    expect(capped).toContain("[중략]");
    expect(capText("short", 100)).toBe("short");
  });
});

describe("fetchFullText", () => {
  const limiter = createRateLimiter(1000);
  it("returns null, not an error, when PMC fails", async () => {
    expect(await fetchFullText("PMC1", { limiter, fetch: async () => new Response("", { status: 500 }) })).toBeNull();
    expect(await fetchFullText("PMC1", { limiter, fetch: async () => { throw new Error("offline"); } })).toBeNull();
  });
  it("requests the pmc database", async () => {
    const urls: string[] = [];
    const text = await fetchFullText("PMC1", { limiter, fetch: async (url) => { urls.push(url); return new Response(xml); } });
    expect(urls[0]).toContain("db=pmc");
    expect(urls[0]).toContain("id=PMC1");
    expect(text).toContain("Discussion");
  });
});
