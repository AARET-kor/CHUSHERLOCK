// lib/papers/pubmed.ts
// Bulk variant of the consult search: more ids, whole abstracts, plus the
// identifiers the library needs (DOI, PMCID, the journal's [ta]).
import { defaultPubMedDeps, efetchUrl, elements, esearchUrl, first, parseArticle, parseEsearch, decodeXml, type PubMedDeps } from "../bbip/literature/pubmed";
import type { PaperRecord } from "./types";

const SEARCH_MAX = 5000;
const FETCH_BATCH = 200;
const TIMEOUT_MS = 30_000;

export type PaperPubMedDeps = Pick<PubMedDeps, "fetch" | "limiter"> & { apiKey?: string };

const EXCLUDED_TYPES = new Set(["comment", "editorial", "erratum", "published erratum", "retracted publication", "retraction of publication"]);

function articleId(body: string, type: string): string | null {
  const data = (first(body, "PubmedData") ?? "").replace(/<ReferenceList>[\s\S]*?<\/ReferenceList>/g, "");
  const hit = elements(data, "ArticleId").find(({ attrs }) => attrs.includes(`IdType="${type}"`));
  return hit ? decodeXml(hit.body).trim() || null : null;
}

export function parsePaperRecords(xml: string): PaperRecord[] {
  return elements(xml, "PubmedArticle").flatMap(({ body }) => {
    const paper = parseArticle(body, Number.MAX_SAFE_INTEGER);
    if (!paper || !paper.abstract.trim()) return [];
    if (paper.publicationTypes.some((type) => EXCLUDED_TYPES.has(type.toLowerCase().trim()))) return [];
    const journalTa = decodeXml(first(first(body, "MedlineJournalInfo") ?? "", "MedlineTA") ?? "") || paper.journal;
    return [
      {
        pmid: paper.pmid,
        doi: articleId(body, "doi"),
        pmcid: articleId(body, "pmc"),
        title: paper.title,
        authors: paper.authors,
        year: paper.year ?? null,
        journalTa,
        abstract: paper.abstract,
        publicationTypes: paper.publicationTypes,
        level: paper.level,
      },
    ];
  });
}

export async function searchPmids(term: string, deps: PaperPubMedDeps = defaultPubMedDeps()): Promise<string[]> {
  await deps.limiter.wait();
  const res = await deps.fetch(esearchUrl(term, deps.apiKey, SEARCH_MAX), { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`PubMed esearch HTTP ${res.status}`);
  return parseEsearch(await res.json());
}

export async function fetchPaperRecords(pmids: string[], deps: PaperPubMedDeps = defaultPubMedDeps()): Promise<PaperRecord[]> {
  const records: PaperRecord[] = [];
  for (let i = 0; i < pmids.length; i += FETCH_BATCH) {
    await deps.limiter.wait();
    const res = await deps.fetch(efetchUrl(pmids.slice(i, i + FETCH_BATCH), deps.apiKey), { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new Error(`PubMed efetch HTTP ${res.status}`);
    records.push(...parsePaperRecords(await res.text()));
  }
  return records;
}
