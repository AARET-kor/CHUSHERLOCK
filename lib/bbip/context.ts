import type Anthropic from "@anthropic-ai/sdk";
import type { CodexEntry } from "../codex/types";
import { getCategory } from "../codex/taxonomy";
import { buildAtlasBlock } from "./anatomy/prompt";
import { anatomyPlanFor } from "./anatomy/regions";
import {
  buildBbipSystemPrompt,
  buildCaseBlock,
  buildLiteratureBlock,
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

const BOOK_TYPES = new Set(["textbook", "book"]);

/** Textbook/book behind a note: the claim with a page wins, then any claim
 * from a book source, then the first book source. */
export function bookRefFor(entry: CodexEntry): NoteRef["book"] {
  const books = new Map(entry.sources.filter((s) => BOOK_TYPES.has(s.type)).map((s) => [s.id, s]));
  if (books.size === 0) return undefined;
  const fromBook = entry.claims.filter((c) => c.sourceId && books.has(c.sourceId));
  const claim = fromBook.find((c) => c.pageStart) ?? fromBook[0];
  const source = (claim?.sourceId ? books.get(claim.sourceId) : undefined) ?? books.values().next().value!;
  return {
    title: source.citation,
    ...(claim?.pageStart ? { page: claim.pageStart } : {}),
    ...(claim ? { claimId: claim.id } : {}),
  };
}

export function noteRefsFor(notes: PromptNote[]): NoteRef[] {
  return notes.map(({ n, entry, verified }) => {
    // Unreviewed drafts render as AI, so they never get a 📖 badge.
    const book = verified ? bookRefFor(entry) : undefined;
    return {
      n,
      id: entry.id,
      title: entry.title,
      categoryLabel: categoryLabel(entry.categoryKey),
      verified,
      ...(book ? { book } : {}),
    };
  });
}

/** Prompt layout, most-stable first:
 *  ① system (static)                         — cache breakpoint
 *  ② case + flags + session notes + atlas structures (per session) — cache breakpoint
 *  ③ literature block (once searched, fixed)  — cache breakpoint
 *  ④ previous cards + this turn's instruction (volatile)
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
  // The atlas block is derived from the chips alone, so it is as stable as
  // the case block.
  const stable = [
    buildCaseBlock(args.session.chips, args.session.flags),
    buildNotesBlock(notes),
    buildAtlasBlock(anatomyPlanFor(args.session.chips)),
  ]
    .filter(Boolean)
    .join("\n\n");
  const literature = buildLiteratureBlock(args.session.literature);
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
          ...(literature
            ? [{ type: "text" as const, text: literature, cache_control: { type: "ephemeral" as const } }]
            : []),
          { type: "text", text: volatile },
        ],
      },
    ],
  };
}
