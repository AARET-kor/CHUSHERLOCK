import type Anthropic from "@anthropic-ai/sdk";
import type { CodexEntry } from "../codex/types";
import { getCategory } from "../codex/taxonomy";
import {
  buildBbipSystemPrompt,
  buildCaseBlock,
  buildNotesBlock,
  buildPriorTurnsBlock,
  buildTurnInstruction,
  isUnverifiedBbipNote,
  type PromptNote,
} from "./prompts";
import type { BbipSession, BbipTurn, NoteRef, TurnRequest } from "./types";

export interface TurnContext {
  system: Anthropic.Beta.BetaTextBlockParam[];
  messages: Anthropic.Beta.BetaMessageParam[];
  noteRefs: NoteRef[];
}

/** Session notes in citation order. A note deleted since the session was
 * created is skipped but the others keep their original [n]. */
export function selectPromptNotes(session: BbipSession, entries: CodexEntry[]): PromptNote[] {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const notes: PromptNote[] = [];
  session.sourceNoteIds.forEach((id, index) => {
    const entry = byId.get(id);
    if (entry) notes.push({ n: index + 1, entry, verified: !isUnverifiedBbipNote(entry) });
  });
  return notes;
}

function categoryLabel(key: string): string {
  try {
    return getCategory(key).labelKo;
  } catch {
    return key;
  }
}

export function noteRefsFor(notes: PromptNote[]): NoteRef[] {
  return notes.map(({ n, entry }) => ({
    n,
    id: entry.id,
    title: entry.title,
    categoryLabel: categoryLabel(entry.categoryKey),
  }));
}

/** Prompt layout, most-stable first:
 *  ① system (static)                         — cache breakpoint
 *  ② case + flags + session notes (per session) — cache breakpoint
 *  ③ previous cards + this turn's instruction (volatile)
 *
 * Cache note: the brief (Opus, low effort), Opus sections (medium effort) and
 * Sonnet sections differ in model/effort, so they are separate cache
 * namespaces — accepted in exchange for brief latency. */
export function buildTurnContext(args: {
  session: BbipSession;
  entries: CodexEntry[];
  priorTurns: BbipTurn[];
  request: TurnRequest;
}): TurnContext {
  const notes = selectPromptNotes(args.session, args.entries);
  const stable = `${buildCaseBlock(args.session.chips, args.session.flags)}\n\n${buildNotesBlock(notes)}`;
  const volatile = [buildPriorTurnsBlock(args.priorTurns), buildTurnInstruction(args.request)]
    .filter(Boolean)
    .join("\n\n");
  return {
    system: [{ type: "text", text: buildBbipSystemPrompt(), cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: stable, cache_control: { type: "ephemeral" } },
          { type: "text", text: volatile },
        ],
      },
    ],
    noteRefs: noteRefsFor(notes),
  };
}
