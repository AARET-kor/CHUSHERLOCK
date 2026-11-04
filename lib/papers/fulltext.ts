// lib/papers/fulltext.ts
// Open-access full text from PMC, used only while analyzing and never stored.
import { decodeXml, defaultPubMedDeps, EUTILS, first } from "../bbip/literature/pubmed";
import type { PaperPubMedDeps } from "./pubmed";

const MIN_BODY_CHARS = 500;
export const MAX_BODY_CHARS = 80_000;
const TIMEOUT_MS = 30_000;

export function parsePmcBody(xml: string): string | null {
  const body = first(xml, "body");
  if (!body) return null;
  const text = decodeXml(
    body
      .replace(/<(table-wrap|fig|xref|supplementary-material)\b[\s\S]*?<\/\1>/g, "")
      .replace(/<\/(p|title|sec)>/g, "$&\n")
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
  return text.length >= MIN_BODY_CHARS ? text : null;
}

/** Long papers keep the opening and the end: methods and the limitations
 * paragraph matter most. The cut is marked so the model knows about it. */
export function capText(text: string, max: number = MAX_BODY_CHARS): string {
  if (text.length <= max) return text;
  const half = Math.floor(max / 2);
  return `${text.slice(0, half)}\n[중략]\n${text.slice(-half)}`;
}

export async function fetchFullText(pmcid: string, deps: PaperPubMedDeps = defaultPubMedDeps()): Promise<string | null> {
  const params = new URLSearchParams({ db: "pmc", id: pmcid, rettype: "xml", tool: "bbip" });
  if (deps.apiKey) params.set("api_key", deps.apiKey);
  try {
    await deps.limiter.wait();
    const res = await deps.fetch(`${EUTILS}/efetch.fcgi?${params}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return null;
    return parsePmcBody(await res.text());
  } catch {
    return null;
  }
}
