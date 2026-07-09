// Lightweight, dependency-free overlap detection so new material naturally
// links to existing entries instead of colliding with or duplicating them.
// This is a placeholder heuristic (title token Jaccard similarity within the
// same category) — the AI classification phase (lib/ai/classify.ts) is meant
// to replace this with semantic similarity later.

export function normalizeTitleTokens(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function titleSimilarity(a: string, b: string): number {
  const tokensA = new Set(normalizeTitleTokens(a));
  const tokensB = new Set(normalizeTitleTokens(b));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) intersection++;
  }
  const union = tokensA.size + tokensB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export const OVERLAP_THRESHOLD = 0.5;

export interface OverlapCandidate {
  id: string;
  title: string;
  categoryKey: string;
}

/** Existing entries in the same category whose title looks like the same
 * topic as `newTitle`, ranked by similarity descending. */
export function findOverlapCandidates<T extends OverlapCandidate>(
  newTitle: string,
  categoryKey: string,
  existing: T[]
): Array<T & { similarity: number }> {
  return existing
    .filter((entry) => entry.categoryKey === categoryKey)
    .map((entry) => ({ ...entry, similarity: titleSimilarity(newTitle, entry.title) }))
    .filter((entry) => entry.similarity >= OVERLAP_THRESHOLD)
    .sort((a, b) => b.similarity - a.similarity);
}
