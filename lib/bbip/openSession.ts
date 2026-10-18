import { retrieve } from "../ai/retrieval";
import type { CodexEntry } from "../codex/types";
import { listEntries } from "../services/entryService";
import { createSession, failStaleTurns, getSession, listTurns } from "../services/bbipService";
import { noteRefsFor, selectPromptNotes } from "./context";
import { mergeFlags, ruleFlags } from "./flags";
import { normalizeChips, parseCase, type ParseResult } from "./parse";
import type { CreateSessionBody } from "./schemas";
import type { BbipSession, NoteRef, ParsedCase, SessionView } from "./types";

export const RETRIEVE_LIMIT = 12;

export function chipQuery(chips: ParsedCase): string {
  return [...chips.procedures, ...chips.conditions, ...chips.meds, ...chips.patient].join(" ");
}

export interface OpenSessionDeps {
  listEntries: () => Promise<CodexEntry[]>;
  parse: (input: string) => Promise<ParseResult>;
}

const defaultDeps: OpenSessionDeps = {
  listEntries: () => listEntries(),
  parse: (input) => parseCase(input),
};

/** Parse (or take edited chips), retrieve once, persist. Retrieval is fixed
 * for the session so every turn shares the same cached prompt prefix. */
export async function openSession(
  body: CreateSessionBody,
  deps: OpenSessionDeps = defaultDeps
): Promise<{ session: BbipSession; notes: NoteRef[]; degraded: boolean }> {
  let parsed: ParseResult;
  if ("chips" in body) {
    // Edited chips skip the parser, so scrub them the same way (PII, caps).
    const chips = normalizeChips(body.chips);
    parsed = { chips, flags: mergeFlags(ruleFlags(chips), []), degraded: false };
  } else {
    parsed = await deps.parse(body.input);
  }
  const entries = await deps.listEntries();
  const retrieved = retrieve(chipQuery(parsed.chips), entries, RETRIEVE_LIMIT).map((r) => r.note);
  const session = createSession({
    chips: parsed.chips,
    flags: parsed.flags,
    sourceNoteIds: retrieved.map((note) => note.id),
  });
  return {
    session,
    notes: noteRefsFor(selectPromptNotes(session, retrieved)),
    degraded: parsed.degraded,
  };
}

export async function loadSessionView(id: string): Promise<SessionView | null> {
  const session = getSession(id);
  if (!session) return null;
  // A crash/restart mid-generation leaves turns "streaming" forever; close them.
  failStaleTurns();
  const entries = await listEntries();
  return {
    session,
    turns: listTurns(id),
    notes: noteRefsFor(selectPromptNotes(session, entries)),
  };
}
