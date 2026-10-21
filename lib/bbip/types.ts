// Domain vocabulary for BBIP — the aesthetic-GP chairside assistant.
// Kept separate from the DB schema so storage can change without reshaping
// the domain (same convention as lib/codex/types.ts).

import type { CareOrder } from "./care/types";

export type FlagLevel = "contraindication" | "caution";

export interface Flag {
  level: FlagLevel;
  text: string;
  /** "rule" = deterministic keyword table (lib/bbip/flags.ts), "model" = parser. */
  source: "rule" | "model";
}

/** Structured chips parsed from the one-line case memo. The raw memo itself
 * is never persisted — only these chips. */
export interface ParsedCase {
  patient: string[];
  conditions: string[];
  meds: string[];
  procedures: string[];
}

export type SectionKey =
  | "cautions"
  | "adverse"
  | "ddx"
  | "tips"
  | "schedule"
  | "homecare"
  | "marketing"
  | "alternatives"
  | "notes";

export type TurnKind = "brief" | "section" | "followup" | "custom" | "literature";
export type TurnStatus = "streaming" | "done" | "failed";

export interface TurnRequest {
  kind: TurnKind;
  sectionKey?: SectionKey;
  question?: string;
}

/** Strength of a literature source, from PubMed publication types
 * (lib/bbip/literature/refs.ts). Highest first. */
export type LitLevel = "guideline" | "meta" | "rct" | "observational" | "case" | "other";

export interface PaperHit {
  pmid: string;
  title: string;
  authors: string[];
  year?: number;
  journal: string;
  abstract: string;
  publicationTypes: string[];
  level: LitLevel;
}

export interface WebHit {
  url: string;
  title: string;
  snippet: string;
}

/** Literature attached to a session by 🔬 문헌 근거 찾기. Citation ids are
 * 1-based positions: papers[0] is [P1], web[0] is [W1]. */
export interface LiteratureBlock {
  pubmedQuery: string;
  webQuery: string;
  papers: PaperHit[];
  web: WebHit[];
  /** Korean message per provider that failed (the other may still have hits). */
  errors: { pubmed?: string; web?: string };
  fetchedAt: string;
}

export interface BbipSession {
  id: string;
  chips: ParsedCase;
  flags: Flag[];
  /** Notes retrieved once at session creation, in relevance order. Index+1
   * is the citation number [n] for every turn of the session. */
  sourceNoteIds: string[];
  /** Set by the literature search; later turns may cite it as [P#]/[W#]. */
  literature?: LiteratureBlock;
  /** Records patient this consult is linked to (Plan 5). */
  patientId?: string;
  promptVersion: string;
  createdAt: string;
}

export interface BbipTurn {
  id: string;
  sessionId: string;
  kind: TurnKind;
  sectionKey?: SectionKey;
  question?: string;
  output: string;
  followups: string[];
  model: string;
  status: TurnStatus;
  error?: string;
  promotedEntryId?: string;
  createdAt: string;
}

/** A citable note as the client sees it: [n] → /entries/id. */
export interface NoteRef {
  n: number;
  id: string;
  title: string;
  categoryLabel: string;
  /** false for unreviewed BBIP drafts — rendered and promoted as AI, never as "my note". */
  verified: boolean;
  /** Textbook/book behind the note's claims: rendered as 📖 *책명* p.x. */
  book?: { title: string; page?: number; claimId?: string };
}

export interface SessionView {
  session: BbipSession;
  turns: BbipTurn[];
  notes: NoteRef[];
  /** The session's 처방·드레싱·F/U order, once drafted. */
  care?: CareOrder | null;
}

export type StreamEvent =
  | { type: "start"; turnId: string }
  | { type: "delta"; text: string }
  | { type: "followups"; items: string[] }
  | { type: "literature"; block: LiteratureBlock }
  | { type: "done"; turnId: string }
  | { type: "error"; message: string };

export const BBIP_PROMPT_VERSION = "bbip-v3";
