import { Marked } from "marked";
import type { Tokens } from "marked";
import type { NoteRef } from "./types";

// The model ends claims with evidence markers: [n] for the doctor's own note
// n, [AI] for unverified model knowledge. Markers are handled by an inline
// marked extension, so they are never touched inside code spans/fences, link
// titles or alt text. A local Marked instance is used so the global `marked`
// (components/MarkdownContent) is not modified.

const MARKER = /\[(\d{1,2}|AI)\]/g;
const SAFE_URL = /^(https?:|mailto:|\/(?!\/)|#)/i;

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

interface EvToken extends Tokens.Generic {
  type: "ev";
  token: string;
}

export function renderEvidenceHtml(markdown: string, notes: NoteRef[]): string {
  const byN = new Map(notes.map((note) => [note.n, note]));
  const marked = new Marked({
    breaks: true,
    async: false,
    extensions: [
      {
        name: "ev",
        level: "inline",
        start: (src: string) => src.indexOf("["),
        tokenizer(src: string) {
          const match = /^\[(\d{1,2}|AI)\]/.exec(src);
          if (!match) return undefined;
          return { type: "ev", raw: match[0], token: match[1]! } as EvToken;
        },
        renderer(token) {
          const { token: value, raw } = token as EvToken;
          if (value === "AI") {
            return '<span class="ev ev-ai" title="검증되지 않은 AI 보충">🤖AI</span>';
          }
          const note = byN.get(Number(value));
          if (!note) return escapeAttr(raw);
          return `<a class="ev ev-note" href="/entries/${encodeURIComponent(note.id)}" title="${escapeAttr(note.title)}">📚${note.n}</a>`;
        },
      },
    ],
    renderer: {
      // Raw HTML from the model is shown as text, never emitted.
      html({ text }: Tokens.HTML | Tokens.Tag) {
        return escapeAttr(text);
      },
      link({ href, title, tokens }: Tokens.Link) {
        const inner = this.parser.parseInline(tokens);
        if (!SAFE_URL.test(href)) return inner;
        const titleAttr = title ? ` title="${escapeAttr(title)}"` : "";
        return `<a href="${escapeAttr(href)}"${titleAttr}>${inner}</a>`;
      },
      image({ href, title, text }: Tokens.Image) {
        if (!SAFE_URL.test(href)) return escapeAttr(text);
        const titleAttr = title ? ` title="${escapeAttr(title)}"` : "";
        return `<img src="${escapeAttr(href)}" alt="${escapeAttr(text)}"${titleAttr}>`;
      },
    },
  });
  return marked.parse(markdown) as string;
}

export function citedNoteNumbers(markdown: string): number[] {
  const numbers = new Set<number>();
  for (const match of markdown.matchAll(MARKER)) {
    if (match[1] !== "AI") numbers.add(Number(match[1]));
  }
  return Array.from(numbers).sort((a, b) => a - b);
}

/** Plain note body for promotion: note markers become relations (dropped
 * from text), AI markers stay visible as "(AI 보충)". Only inter-word space
 * runs are collapsed, so list indentation and blank lines survive. */
export function toPlainNoteText(markdown: string): string {
  return markdown
    .replace(/\[AI\]/g, " (AI 보충)")
    .replace(/^([ \t]*)\[(\d{1,2})\][ \t]?/gm, "$1")
    .replace(/[ \t]*\[(\d{1,2})\]/g, "")
    .replace(/(\S) {2,}(?=\S)/g, "$1 ")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}
