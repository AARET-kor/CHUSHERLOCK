import { Marked } from "marked";
import type { Tokens } from "marked";
import { ATLAS_TOKEN_START, atlasChipHtml, atlasTokensToText } from "./anatomy/tokens";
import type { NoteRef } from "./types";

// The model ends claims with evidence markers: [n] for the doctor's own note
// n, [AI] for unverified model knowledge. A [n] that points at an unreviewed
// BBIP draft is shown (and promoted) as AI, never as "my note". {{atlas:id}}
// becomes a chip that focuses the anatomy map (unknown ids → plain text).
// Markers are handled by an inline
// marked extension, so they are never touched inside code spans/fences, link
// titles or alt text. A local Marked instance is used so the global `marked`
// (components/MarkdownContent) is not modified.

const MARKER = /\[(\d{1,2}|AI)\]/g;
const SAFE_URL = /^(https?:|mailto:|\/(?![\/\\])|#)/i;

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

interface AtlasToken extends Tokens.Generic {
  type: "atlas";
  id: string;
}

// Built once; the notes for the current call are passed through this
// module-level map (parsing is synchronous, so calls cannot interleave).
let currentNotes = new Map<number, NoteRef>();

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
        const note = currentNotes.get(Number(value));
        if (!note) return escapeAttr(raw);
        const href = `/entries/${encodeURIComponent(note.id)}`;
        if (!note.verified) {
          return `<a class="ev ev-ai" href="${href}" title="검토 전 BBIP 초안 — 노트 링크">🤖AI</a>`;
        }
        return `<a class="ev ev-note" href="${href}" title="${escapeAttr(note.title)}">📚${note.n}</a>`;
      },
    },
    {
      name: "atlas",
      level: "inline",
      start: (src: string) => {
        const index = src.indexOf("{{atlas:");
        return index < 0 ? undefined : index;
      },
      tokenizer(src: string) {
        const match = ATLAS_TOKEN_START.exec(src);
        if (!match) return undefined;
        return { type: "atlas", raw: match[0], id: match[1]! } as AtlasToken;
      },
      renderer(token) {
        return atlasChipHtml((token as AtlasToken).id);
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
    // Images are never loaded (tracking/exfiltration); show the alt text.
    image({ text }: Tokens.Image) {
      return escapeAttr(text);
    },
  },
});

// "**강조[1]**은": marked treats "]" as punctuation, so a closing "**" right
// after a marker followed by a letter is not right-flanking and emphasis
// fails. Move trailing markers outside the closing delimiter first.
const EMPH_FIX = /((?:\s*\[(?:\d{1,2}|AI)\])+)(\*{1,3}|_{1,3})(?=[^\s\p{P}])/gu;

export function renderEvidenceHtml(markdown: string, notes: NoteRef[]): string {
  currentNotes = new Map(notes.map((note) => [note.n, note]));
  try {
    return marked.parse(markdown.replace(EMPH_FIX, "$2$1")) as string;
  } finally {
    currentNotes = new Map();
  }
}

export function citedNoteNumbers(markdown: string): number[] {
  const numbers = new Set<number>();
  for (const match of markdown.matchAll(MARKER)) {
    if (match[1] !== "AI") numbers.add(Number(match[1]));
  }
  return Array.from(numbers).sort((a, b) => a - b);
}

/** Plain note body for promotion: atlas tokens are spelled out, note
 * markers become relations (dropped from text), AI markers — and markers of `unverified` notes (BBIP drafts) —
 * stay visible as "(AI 보충)". Only inter-word space runs are collapsed, so
 * list indentation and blank lines survive. */
export function toPlainNoteText(
  markdown: string,
  unverified: ReadonlySet<number> = new Set()
): string {
  return atlasTokensToText(markdown)
    .replace(/\[(\d{1,2})\]/g, (marker, n: string) => (unverified.has(Number(n)) ? "[AI]" : marker))
    .replace(/\[AI\](?:[ \t]*\[AI\])+/g, "[AI]")
    .replace(/^([ \t]*)\[AI\]/gm, "$1(AI 보충)")
    .replace(/\[AI\]/g, " (AI 보충)")
    .replace(/^([ \t]*)\[(\d{1,2})\][ \t]?/gm, "$1")
    .replace(/[ \t]*\[(\d{1,2})\]/g, "")
    .replace(/(\S) {2,}(?=\S)/g, "$1 ")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}
