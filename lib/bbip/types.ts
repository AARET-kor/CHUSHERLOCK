// Domain vocabulary for BBIP — the aesthetic-GP chairside assistant.
// Kept separate from the DB schema so storage can change without reshaping
// the domain (same convention as lib/codex/types.ts).

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

export type TurnKind = "brief" | "section" | "followup" | "custom";
export type TurnStatus = "streaming" | "done" | "failed";

export interface TurnRequest {
  kind: TurnKind;
  sectionKey?: SectionKey;
  question?: string;
}

export interface BbipSession {
  id: string;
  chips: ParsedCase;
  flags: Flag[];
  /** Notes retrieved once at session creation, in relevance order. Index+1
   * is the citation number [n] for every turn of the session. */
  sourceNoteIds: string[];
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
}

export interface SessionView {
  session: BbipSession;
  turns: BbipTurn[];
  notes: NoteRef[];
}

export type StreamEvent =
  | { type: "start"; turnId: string }
  | { type: "delta"; text: string }
  | { type: "followups"; items: string[] }
  | { type: "done"; turnId: string }
  | { type: "error"; message: string };

export const BBIP_PROMPT_VERSION = "bbip-v1";
