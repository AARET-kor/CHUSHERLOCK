// lib/papers/types.ts
import type { LitLevel } from "../bbip/types";

export const TOPIC_KEYS = ["filler", "thread", "energy", "pigment"] as const;
export type TopicKey = (typeof TOPIC_KEYS)[number];

export type PaperStatus = "pending" | "analyzing" | "analyzed" | "failed";
export type ReviewStatus = "unreviewed" | "reviewed" | "excluded";
export type SubjectKind = "human" | "animal" | "in_vitro" | "review" | "unclear";
export type SyncKind = "weekly" | "manual";

export interface PaperAnalysis {
  source: "fulltext" | "abstract";
  subject: { kind: SubjectKind; detail: string; n: number | null };
  material: string;
  followUp: string | null;
  findings: string[];
  limitations: Array<{ text: string; quote: string | null; quoteVerified: boolean }>;
  canClaim: string[];
  cannotClaim: string[];
  implications: Array<{ kind: "procedure" | "consult"; text: string }>;
}

/** What PubMed gives us, before any analysis. */
export interface PaperRecord {
  pmid: string;
  doi: string | null;
  pmcid: string | null;
  title: string;
  authors: string[];
  year: number | null;
  journalTa: string;
  abstract: string;
  publicationTypes: string[];
  level: LitLevel;
}

export interface PaperRow extends PaperRecord {
  topics: TopicKey[];
  status: PaperStatus;
  attempts: number;
  error: string | null;
  analysis: PaperAnalysis | null;
  analysisModel: string | null;
  analyzedAt: string | null;
  reviewStatus: ReviewStatus;
  createdAt: string;
  impactFactor: number | null;
  journalName: string | null;
}

export interface Journal {
  ta: string;
  name: string;
  impactFactor: number | null;
  ifYear: number | null;
  edited: boolean;
}

export interface SyncRun {
  id: string;
  kind: SyncKind;
  startedAt: string;
  finishedAt: string | null;
  added: number;
  analyzed: number;
  error: string | null;
}

export interface PaperFilters {
  topic?: TopicKey;
  level?: LitLevel;
  subject?: SubjectKind;
  analysis?: "analyzed" | "unanalyzed";
  review?: ReviewStatus;
  sort?: "if" | "recent";
  page?: number;
}
