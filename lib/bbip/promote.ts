import type { ContentTier, EvidenceLevel } from "../codex/types";
import { getLeafCategories } from "../codex/taxonomy";
import { createEntrySchema, type CreateEntryInput } from "../schemas/entrySchemas";
import { citedLiterature, citedNoteNumbers, toPlainNoteText } from "./evidence";
import { authorsShort, bestEvidence, paperCitation, pubmedUrl, toEvidenceLevel } from "./literature/refs";
import { BBIP_SOURCE_PREFIX, type PromptNote } from "./prompts";
import { getSection, turnTitle } from "./sections";
import type { BbipSession, BbipTurn, LiteratureBlock, NoteRef } from "./types";

type SourceInput = CreateEntryInput["sources"][number];

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

/** The card cannot become a valid note (e.g. too short once markers are stripped). */
export class PromoteValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PromoteValidationError";
  }
}

const TABLE_RULE = /^[\s|:-]+$/;

/** Cited P#/W# → source rows (index 0 stays the AI source) and, per marker,
 * the source index and evidence level its claims inherit. */
export function literatureSources(
  raw: string,
  literature: LiteratureBlock | undefined
): { sources: SourceInput[]; byMarker: Map<string, { index: number; level: EvidenceLevel }> } {
  const sources: SourceInput[] = [];
  const byMarker = new Map<string, { index: number; level: EvidenceLevel }>();
  if (!literature) return { sources, byMarker };
  const cited = citedLiterature(raw);
  for (const n of cited.papers) {
    const paper = literature.papers[n - 1];
    if (!paper) continue;
    const level = toEvidenceLevel(paper.level);
    sources.push({
      type: "paper",
      citation: paperCitation(paper),
      url: pubmedUrl(paper.pmid),
      ...(paper.authors.length ? { authors: authorsShort(paper.authors) } : {}),
      ...(paper.year ? { year: paper.year } : {}),
      evidenceLevel: level,
    });
    byMarker.set(`P${n}`, { index: sources.length, level });
  }
  for (const n of cited.web) {
    const hit = literature.web[n - 1];
    if (!hit || !/^https?:\/\//i.test(hit.url)) continue;
    sources.push({ type: "website", citation: `${hit.title} — ${hit.url}`, url: hit.url });
    byMarker.set(`W${n}`, { index: sources.length, level: "unknown" });
  }
  return { sources, byMarker };
}

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
  // Unreviewed BBIP drafts are AI content: spelled out, never related.
  const unverified = new Set(args.notes.filter((n) => !n.verified).map((n) => n.n));
  const literature = args.session.literature;
  const content = toPlainNoteText(raw, unverified, literature);
  const { sources: litSources, byMarker } = literatureSources(raw, literature);
  const date = args.today ?? new Date().toISOString().slice(0, 10);
  const location = `BBIP 세션 ${args.session.id.slice(0, 8)} · ${turnTitle(args.turn)}`;
  // Claims are cut from the raw lines so each keeps its own P#/W# markers:
  // the first cited source becomes its sourceIndex, the best paper its level.
  const claims = raw
    .split("\n")
    .filter((line) => !TABLE_RULE.test(line))
    .map((line) => {
      const refs = Array.from(line.matchAll(/\[([PW]\d{1,2})\]/g), (m) => byMarker.get(m[1]!)).filter(
        (ref): ref is { index: number; level: EvidenceLevel } => ref !== undefined
      );
      const claimText = toPlainNoteText(line, unverified, literature)
        .replace(/^[-*>#\s|]+/, "")
        .replace(/\|/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      return { claimText, refs };
    })
    .filter(({ claimText }) => claimText.length >= 8)
    .slice(0, 50)
    .map(({ claimText, refs }) => ({
      claimText: claimText.slice(0, 4000),
      representation: "ai_paraphrase" as const,
      sourceLocation: location,
      sourceIndex: refs[0]?.index ?? 0,
      evidenceLevel: bestEvidence(refs.map((ref) => ref.level)),
      conflictStatus: "none" as const,
    }));

  const result = createEntrySchema.safeParse({
    title: args.title,
    content,
    categoryKey: args.categoryKey,
    tier: args.tier,
    tags: Array.from(new Set(["bbip", ...args.session.chips.procedures])).slice(0, 10),
    sources: [
      { type: "other", citation: `${BBIP_SOURCE_PREFIX} · ${args.turn.model} · ${date}` },
      ...litSources,
    ],
    relatedEntryIds: args.notes.filter((n) => n.verified && cited.has(n.n)).map((n) => n.id),
    figureIds: [],
    claims,
    provenance: { model: args.turn.model, promptVersion: args.session.promptVersion },
    status: "draft",
  });
  if (!result.success) {
    throw new PromoteValidationError(
      result.error.issues[0]?.message ?? "노트 내용을 확인해 주세요."
    );
  }
  return result.data;
}
