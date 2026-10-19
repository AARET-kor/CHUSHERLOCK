// lib/bbip/literature/refs.ts
import type { EvidenceLevel } from "../../codex/types";
import type { LitLevel, PaperHit } from "../types";

// Pure literature helpers shared by the server and the console (no Node or
// SDK imports here — this file is bundled for the browser).

export const LEVEL_LABEL: Record<LitLevel, string> = {
  guideline: "가이드라인",
  meta: "메타분석·SR",
  rct: "RCT",
  observational: "관찰·임상연구",
  case: "증례",
  other: "리뷰·기타",
};

/** PubMed publication types → evidence level, strongest match wins. */
export function levelFromTypes(types: string[]): LitLevel {
  const t = types.map((type) => type.toLowerCase().trim());
  const has = (...names: string[]) => names.some((name) => t.includes(name));
  if (has("practice guideline", "guideline")) return "guideline";
  if (has("meta-analysis", "systematic review")) return "meta";
  if (t.some((type) => type.startsWith("randomized controlled trial"))) return "rct";
  if (
    has("controlled clinical trial", "clinical trial", "comparative study", "observational study", "multicenter study") ||
    t.some((type) => type.startsWith("clinical trial, phase"))
  ) {
    return "observational";
  }
  if (has("case reports")) return "case";
  return "other";
}

const TO_EVIDENCE: Record<LitLevel, EvidenceLevel> = {
  guideline: "guideline",
  meta: "systematic_review",
  rct: "randomized_trial",
  observational: "observational",
  case: "observational",
  other: "unknown",
};

export function toEvidenceLevel(level: LitLevel): EvidenceLevel {
  return TO_EVIDENCE[level];
}

const EVIDENCE_RANK: EvidenceLevel[] = [
  "unknown",
  "expert_consensus",
  "observational",
  "randomized_trial",
  "systematic_review",
  "guideline",
];

export function bestEvidence(levels: EvidenceLevel[]): EvidenceLevel {
  return levels.reduce<EvidenceLevel>(
    (best, level) => (EVIDENCE_RANK.indexOf(level) > EVIDENCE_RANK.indexOf(best) ? level : best),
    "unknown"
  );
}

export function pubmedUrl(pmid: string): string {
  return `https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(pmid)}/`;
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function authorsShort(authors: string[]): string {
  return authors.length > 3 ? `${authors.slice(0, 3).join(", ")} et al.` : authors.join(", ");
}

/** Stable, unique citation (sources are de-duplicated by citation). */
export function paperCitation(paper: PaperHit): string {
  const head = [authorsShort(paper.authors), paper.year ? `(${paper.year})` : ""].filter(Boolean).join(" ");
  return [head, paper.title, paper.journal, `PMID ${paper.pmid}`].filter(Boolean).join(". ");
}
