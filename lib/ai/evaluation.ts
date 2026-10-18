import type { SuggestedEntry } from "./schemas";

export interface IngestQualityIssue {
  code:
    | "missing_claims"
    | "missing_page"
    | "invented_quote"
    | "uncovered_number"
    | "page_marker_leak";
  entryTitle: string;
  detail: string;
}

function normalize(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function boldClinicalNumbers(markdown: string): string[] {
  const tokens: string[] = [];
  for (const match of markdown.matchAll(/\*\*([^*]*\d[^*]*)\*\*/g)) {
    for (const token of match[1]!.match(/\d+(?:\.\d+)?\s*(?:mg|ml|u|j|mm|cm|%|hz|w)?/gi) ?? []) {
      tokens.push(normalize(token));
    }
  }
  return Array.from(new Set(tokens));
}

/**
 * Deterministic offline gate for AI ingest regressions. It does not judge
 * medical truth; it catches provenance failures that should never reach a
 * reviewer: invented quotes, missing page anchors, leaked page markers, and
 * bold clinical numbers with no corresponding claim.
 */
export function evaluateIngestQuality(
  sourceText: string,
  entries: SuggestedEntry[]
): IngestQualityIssue[] {
  const issues: IngestQualityIssue[] = [];
  const normalizedSource = normalize(sourceText.replace(/\[\[페이지 \d+\]\]/g, ""));
  const sourceHasPages = /\[\[페이지 \d+\]\]/.test(sourceText);

  for (const entry of entries) {
    if (entry.claims.length < 3) {
      issues.push({
        code: "missing_claims",
        entryTitle: entry.title,
        detail: `expected at least 3 claims, received ${entry.claims.length}`,
      });
    }
    if (/\[\[페이지 \d+\]\]/.test(entry.content)) {
      issues.push({
        code: "page_marker_leak",
        entryTitle: entry.title,
        detail: "internal page marker leaked into note content",
      });
    }
    for (const claim of entry.claims) {
      if (sourceHasPages && claim.pageStart === null) {
        issues.push({
          code: "missing_page",
          entryTitle: entry.title,
          detail: claim.claimText,
        });
      }
      if (claim.originalQuote && !normalizedSource.includes(normalize(claim.originalQuote))) {
        issues.push({
          code: "invented_quote",
          entryTitle: entry.title,
          detail: claim.originalQuote,
        });
      }
    }
    const claimCorpus = normalize(
      entry.claims.map((claim) => `${claim.claimText} ${claim.originalQuote}`).join(" ")
    );
    for (const number of boldClinicalNumbers(entry.content)) {
      if (!claimCorpus.includes(number)) {
        issues.push({
          code: "uncovered_number",
          entryTitle: entry.title,
          detail: number,
        });
      }
    }
  }
  return issues;
}
