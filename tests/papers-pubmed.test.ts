// tests/papers-pubmed.test.ts
import { describe, expect, it } from "vitest";
import { createRateLimiter } from "../lib/bbip/literature/pubmed";
import { fetchPaperRecords, parsePaperRecords, searchPmids } from "../lib/papers/pubmed";

const article = (pmid: string, type: string, abstract = "Key limitation of this study.") => `
<PubmedArticle><MedlineCitation><PMID Version="1">${pmid}</PMID>
<Article><Journal><JournalIssue><PubDate><Year>2026</Year></PubDate></JournalIssue><ISOAbbreviation>J Cosmet Dermatol</ISOAbbreviation></Journal>
<ArticleTitle>Hyaluronidase title ${pmid}</ArticleTitle>
<Abstract><AbstractText Label="METHODS">${abstract}</AbstractText></Abstract>
<AuthorList><Author><LastName>Yin</LastName><Initials>X</Initials></Author></AuthorList>
<PublicationTypeList><PublicationType>${type}</PublicationType></PublicationTypeList></Article>
<MedlineJournalInfo><MedlineTA>J Cosmet Dermatol</MedlineTA></MedlineJournalInfo></MedlineCitation>
<PubmedData><ArticleIdList><ArticleId IdType="pubmed">${pmid}</ArticleId><ArticleId IdType="doi">10.1111/jocd.${pmid}</ArticleId><ArticleId IdType="pmc">PMC${pmid}</ArticleId></ArticleIdList>
<ReferenceList><Reference><ArticleIdList><ArticleId IdType="doi">10.9999/wrong</ArticleId><ArticleId IdType="pmc">PMC000</ArticleId></ArticleIdList></Reference></ReferenceList></PubmedData></PubmedArticle>`;

describe("parsePaperRecords", () => {
  it("reads ids from the article, not its reference list", () => {
    expect(parsePaperRecords(article("111", "Journal Article"))[0]).toMatchObject({
      pmid: "111",
      doi: "10.1111/jocd.111",
      pmcid: "PMC111",
      journalTa: "J Cosmet Dermatol",
      year: 2026,
      level: "other",
      abstract: "METHODS: Key limitation of this study.",
    });
  });

  it("keeps long abstracts whole", () => {
    expect(parsePaperRecords(article("112", "Journal Article", "가".repeat(5000)))[0]!.abstract.length).toBeGreaterThan(5000);
  });

  it.each(["Comment", "Editorial", "Published Erratum", "Retracted Publication"])("drops %s", (type) => {
    expect(parsePaperRecords(article("113", type))).toEqual([]);
  });

  it("drops a paper without an abstract", () => {
    expect(parsePaperRecords(article("114", "Journal Article", ""))).toEqual([]);
  });
});

describe("network helpers", () => {
  const limiter = createRateLimiter(1000);
  const base = { limiter, retryDelayMs: 0 };

  it("posts the search and asks for up to 5000 ids", async () => {
    const bodies: string[] = [];
    const ids = await searchPmids("term", {
      ...base,
      fetch: async (_url, init) => {
        expect(init?.method).toBe("POST");
        bodies.push(String(init?.body));
        return Response.json({ esearchresult: { idlist: ["1", "2"] } });
      },
    });
    expect(ids).toEqual(["1", "2"]);
    expect(bodies[0]).toContain("retmax=5000");
  });

  it("posts ids in batches of 200, because long GET URLs fail at NCBI", async () => {
    const urls: string[] = [];
    const ids = Array.from({ length: 450 }, (_, i) => String(i + 1));
    await fetchPaperRecords(ids, {
      ...base,
      fetch: async (url, init) => {
        expect(init?.method).toBe("POST");
        urls.push(url);
        return new Response("<PubmedArticleSet></PubmedArticleSet>");
      },
    });
    expect(urls).toHaveLength(3);
    expect(urls[0]).not.toContain("id=");
  });

  it("retries a transient failure", async () => {
    let calls = 0;
    const ids = await searchPmids("term", {
      ...base,
      fetch: async () => {
        calls += 1;
        return calls < 3 ? new Response("", { status: 502 }) : Response.json({ esearchresult: { idlist: ["7"] } });
      },
    });
    expect(ids).toEqual(["7"]);
    expect(calls).toBe(3);
  });

  it("throws after three failures so the sync can retry that period", async () => {
    let calls = 0;
    await expect(
      searchPmids("term", {
        ...base,
        fetch: async () => {
          calls += 1;
          return new Response("", { status: 500 });
        },
      })
    ).rejects.toThrow("500");
    expect(calls).toBe(3);
  });
});
