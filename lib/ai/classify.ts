import type { ContentTier } from "../codex/types";

/**
 * NOT IMPLEMENTED YET.
 *
 * This is the extension point for the next phase: LLM-backed auto
 * classification. When wired up, pasting raw material (a paper abstract, a
 * device parameter sheet, a chapter of notes) should return a suggestion the
 * user can accept/edit in the entry form, instead of manually picking every
 * field.
 *
 * Planned behavior:
 * - categoryKey: best-matching leaf category from lib/codex/taxonomy.ts
 *   (the model should be given the full taxonomy list as its label set,
 *   not asked to invent new categories).
 * - tier: one of the four ContentTier values from lib/codex/tiers.ts —
 *   the model must decide whether this is a quick procedure tip, a
 *   chairside talking point, deep study material, or base medical
 *   knowledge, per the product brief.
 * - title: a short descriptive title, not a truncation of the input.
 * - content: the cleaned-up bilingual body — reformatted for readability,
 *   not aggressively summarized (the brief is explicit: don't over-compress).
 * - suggestedRelatedEntryIds: candidates from entryService.previewOverlaps,
 *   re-ranked by the model using semantic similarity instead of the current
 *   title-token Jaccard heuristic in lib/codex/overlap.ts.
 * - sources: extracted citation(s) if present in the input text.
 */
export interface ClassificationSuggestion {
  categoryKey: string;
  tier: ContentTier;
  title: string;
  content: string;
  tags: string[];
  confidence: number;
}

export async function classifyMaterial(_rawText: string): Promise<ClassificationSuggestion> {
  throw new Error(
    "classifyMaterial() is not implemented yet. This scaffold phase ships the " +
      "data model, taxonomy, and manual entry flow; wire an LLM call here next."
  );
}
