import { retrieve } from "../ai/retrieval";
import type { CodexEntry } from "../codex/types";
import { listEntries } from "../services/entryService";
import { createSession, failOrphanedTurns, getSession, listTurns } from "../services/bbipService";
import { getCareOrder } from "../services/careService";
import { noteRefsFor, selectPromptNotes } from "./context";
import { mergeFlags, ruleFlags } from "./flags";
import { extractChartNo } from "../records/chart";
import { matchPatients } from "../records/match";
import { todayIso } from "../records/schedule";
import {
  getPatientByChartNo,
  listPatientSummaries,
  patientSummary,
  visitForSession,
} from "../services/recordsService";
import { normalizeChips, parseCase, sanitizeInput, type ParseResult } from "./parse";
import { activeTurnIds } from "./runTurn";
import type { CreateSessionBody } from "./schemas";
import type { BbipSession, NoteRef, ParsedCase, SessionLink, SessionView } from "./types";

export const RETRIEVE_LIMIT = 12;

/** The case had nothing left after PII scrubbing. */
export class EmptyCaseError extends Error {
  constructor() {
    super("케이스를 확인해 주세요.");
    this.name = "EmptyCaseError";
  }
}

function hasChips(c: ParsedCase): boolean {
  return c.patient.length + c.conditions.length + c.meds.length + c.procedures.length > 0;
}

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
): Promise<{ session: BbipSession; notes: NoteRef[]; degraded: boolean; link: SessionLink }> {
  let parsed: ParseResult;
  let chartNo: string | null = null;
  let inheritedPatientId: string | null = null;
  if ("chips" in body) {
    // Edited chips skip the parser, so scrub them the same way (PII, caps).
    const chips = normalizeChips(body.chips);
    if (!hasChips(chips)) throw new EmptyCaseError();
    // Flags of the edited session came from the raw memo and the parser too;
    // keep them (they all say "확인 필요") rather than silently dropping a
    // safety flag because its chip was removed or never extracted. The
    // records patient link is kept as well.
    const base = body.baseSessionId ? getSession(body.baseSessionId) : null;
    inheritedPatientId = base?.patientId ?? null;
    parsed = { chips, flags: mergeFlags(ruleFlags(chips), base?.flags ?? []), degraded: false };
  } else {
    // "#20431" names the records patient; it never reaches the parser.
    const extracted = extractChartNo(body.input);
    chartNo = extracted.chartNo;
    if (sanitizeInput(extracted.rest).length < 2) throw new EmptyCaseError();
    parsed = await deps.parse(extracted.rest);
    if (!hasChips(parsed.chips)) throw new EmptyCaseError();
  }
  const patient = chartNo ? getPatientByChartNo(chartNo) : null;
  const patientId = patient?.id ?? inheritedPatientId;
  const entries = await deps.listEntries();
  const retrieved = retrieve(chipQuery(parsed.chips), entries, RETRIEVE_LIMIT).map((r) => r.note);
  const session = createSession({
    chips: parsed.chips,
    flags: parsed.flags,
    sourceNoteIds: retrieved.map((note) => note.id),
    patientId,
  });
  const link: SessionLink = {
    patient: patientId ? patientSummary(patientId) : null,
    pendingChartNo: chartNo && !patient ? chartNo : null,
    candidates: patientId || chartNo ? [] : matchPatients(parsed.chips, listPatientSummaries(), todayIso()),
  };
  return {
    session,
    notes: noteRefsFor(selectPromptNotes(session, retrieved)),
    degraded: parsed.degraded,
    link,
  };
}

export async function loadSessionView(id: string): Promise<SessionView | null> {
  const session = getSession(id);
  if (!session) return null;
  // A crash/restart mid-generation leaves turns "streaming" forever; close
  // the ones no live generator in this process owns.
  failOrphanedTurns(id, activeTurnIds());
  const entries = await listEntries();
  return {
    session,
    turns: listTurns(id),
    notes: noteRefsFor(selectPromptNotes(session, entries)),
    care: getCareOrder(id),
    link: {
      patient: session.patientId ? patientSummary(session.patientId) : null,
      pendingChartNo: null,
      candidates: [],
    },
    visit: visitForSession(id),
  };
}
