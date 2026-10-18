import type { ContentTier } from "../codex/types";
import { getLeafCategories } from "../codex/taxonomy";
import { createEntrySchema, type CreateEntryInput } from "../schemas/entrySchemas";
import { citedNoteNumbers, toPlainNoteText } from "./evidence";
import { BBIP_SOURCE_PREFIX, type PromptNote } from "./prompts";
import { getSection, turnTitle } from "./sections";
import type { BbipSession, BbipTurn, NoteRef } from "./types";

/** Used when no session note sits in a leaf category. */
export const FALLBACK_CATEGORY = "realistic-expectation";

export interface PromoteDefaults {
  title: string;
  categoryKey: string;
  tier: ContentTier;
}

export function defaultTier(turn: BbipTurn): ContentTier {
  if (turn.kind === "section" && turn.sectionKey) return getSection(turn.sectionKey).promoteTier;
  return turn.kind === "brief" ? "procedure_tip" : "deep_study";
}

export function suggestTitle(session: BbipSession, turn: BbipTurn): string {
  const subject =
    [...session.chips.procedures, ...session.chips.conditions].slice(0, 3).join("·") || "케이스";
  const label = turnTitle(turn).replace(/^\S+\s/, "");
  return `${subject} — ${label}`.slice(0, 200);
}

/** Category of the most relevant session note (deterministic, editable). */
export function suggestCategory(notes: PromptNote[]): string {
  const leafKeys = new Set(getLeafCategories().map((c) => c.key));
  return notes.find((n) => leafKeys.has(n.entry.categoryKey))?.entry.categoryKey ?? FALLBACK_CATEGORY;
}

export function promoteDefaults(
  session: BbipSession,
  turn: BbipTurn,
  notes: PromptNote[]
): PromoteDefaults {
  return {
    title: suggestTitle(session, turn),
    categoryKey: suggestCategory(notes),
    tier: defaultTier(turn),
  };
}

const TABLE_RULE = /^[\s|:-]+$/;

export function buildPromoteInput(args: {
  session: BbipSession;
  turn: BbipTurn;
  notes: NoteRef[];
  title: string;
  categoryKey: string;
  tier: ContentTier;
  selection?: string;
  today?: string;
}): CreateEntryInput {
  const raw = (args.selection ?? args.turn.output).trim();
  const cited = new Set(citedNoteNumbers(raw));
  const content = toPlainNoteText(raw);
  const date = args.today ?? new Date().toISOString().slice(0, 10);
  const location = `BBIP 세션 ${args.session.id.slice(0, 8)} · ${turnTitle(args.turn)}`;
  const claims = content
    .split("\n")
    .filter((line) => !TABLE_RULE.test(line))
    .map((line) => line.replace(/^[-*>#\s|]+/, "").replace(/\|/g, " ").replace(/\s+/g, " ").trim())
    .filter((line) => line.length >= 8)
    .slice(0, 50)
    .map((claimText) => ({
      claimText: claimText.slice(0, 4000),
      representation: "ai_paraphrase" as const,
      sourceLocation: location,
      sourceIndex: 0,
      evidenceLevel: "unknown" as const,
      conflictStatus: "none" as const,
    }));

  return createEntrySchema.parse({
    title: args.title,
    content,
    categoryKey: args.categoryKey,
    tier: args.tier,
    tags: Array.from(new Set(["bbip", ...args.session.chips.procedures])).slice(0, 10),
    sources: [{ type: "other", citation: `${BBIP_SOURCE_PREFIX} · ${args.turn.model} · ${date}` }],
    relatedEntryIds: args.notes.filter((n) => cited.has(n.n)).map((n) => n.id),
    figureIds: [],
    claims,
    provenance: { model: args.turn.model, promptVersion: args.session.promptVersion },
    status: "draft",
  });
}
