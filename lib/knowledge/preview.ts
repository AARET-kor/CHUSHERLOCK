import { stripDecorations } from "../codex/decorations";

/** An excerpt, never a generated clinical summary. */
export function noteExcerpt(content: string, limit = 240): string {
  const plain = stripDecorations(content)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]*>/g, "")
    .replace(/^\s{0,3}(?:#{1,6}\s+|>\s*|[-*+]\s+|\d+\.\s+)/gm, "")
    .replace(/[*_`~]/g, "")
    .replace(/\s+/g, " ").trim();
  return plain.length > limit ? plain.slice(0, limit) + "…" : plain;
}
