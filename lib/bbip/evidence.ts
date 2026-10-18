import { marked } from "marked";
import type { NoteRef } from "./types";

// The model ends claims with evidence markers: [n] for the doctor's own note
// n, [AI] for unverified model knowledge. Markers are swapped for Unicode
// private-use sentinels before Markdown parsing (so marked never mistakes
// them for link syntax), then replaced with badge HTML afterwards.

const MARKER = /\[(\d{1,2}|AI)\]/g;
const OPEN = "";
const CLOSE = "";
const SENTINEL = new RegExp(`${OPEN}(\\d{1,2}|AI)${CLOSE}`, "g");

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

export function renderEvidenceHtml(markdown: string, notes: NoteRef[]): string {
  const byN = new Map(notes.map((note) => [note.n, note]));
  const withSentinels = markdown.replace(MARKER, (_match, token: string) => `${OPEN}${token}${CLOSE}`);
  // Same escaping rule as components/MarkdownContent: neutralize raw HTML,
  // keep ">" so blockquotes still parse.
  const escaped = withSentinels.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const html = marked.parse(escaped, { breaks: true, async: false }) as string;
  return html.replace(SENTINEL, (_match, token: string) => {
    if (token === "AI") {
      return '<span class="ev ev-ai" title="검증되지 않은 AI 보충">🤖AI</span>';
    }
    const note = byN.get(Number(token));
    if (!note) return `[${token}]`;
    return `<a class="ev ev-note" href="/entries/${note.id}" title="${escapeAttr(note.title)}">📚${note.n}</a>`;
  });
}

export function citedNoteNumbers(markdown: string): number[] {
  const numbers = new Set<number>();
  for (const match of markdown.matchAll(MARKER)) {
    if (match[1] !== "AI") numbers.add(Number(match[1]));
  }
  return Array.from(numbers).sort((a, b) => a - b);
}

/** Plain note body for promotion: note markers become relations (dropped
 * from text), AI markers stay visible as "(AI 보충)". */
export function toPlainNoteText(markdown: string): string {
  return markdown
    .replace(/\[AI\]/g, " (AI 보충)")
    .replace(/\s*\[(\d{1,2})\]/g, "")
    .replace(/ {2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}
