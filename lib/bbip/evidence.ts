import { Marked } from "marked";
import type { Tokens } from "marked";
import { hostOf, LEVEL_LABEL, pubmedUrl } from "./literature/refs";
import type { LiteratureBlock, NoteRef } from "./types";

// The model ends claims with evidence markers: [n] for the doctor's own note
// n (its textbook and page when the note's claims come from one), [P#] for a
// PubMed paper and [W#] for a web page of the session's literature block,
// [AI] for unverified model knowledge. All render as footnote superscripts. A [n] that points at an unreviewed
// BBIP draft is shown (and promoted) as AI, never as "my note". Markers are handled by an inline
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

// Built once; the notes for the current call are passed through this
// module-level map (parsing is synchronous, so calls cannot interleave).
let currentNotes = new Map<number, NoteRef>();
let currentLiterature: LiteratureBlock | undefined;

const marked = new Marked({
  breaks: true,
  async: false,
  extensions: [
    {
      name: "ev",
      level: "inline",
      start: (src: string) => src.indexOf("["),
      tokenizer(src: string) {
        const match = /^\[(\d{1,2}|AI|[PW]\d{1,2})\]/.exec(src);
        if (!match) return undefined;
        return { type: "ev", raw: match[0], token: match[1]! } as EvToken;
      },
      renderer(token) {
        const { token: value, raw } = token as EvToken;
        if (value === "AI") {
          return '<span class="ev ev-ai" title="내 노트에 없는 AI 보충 — 검토 필요">AI</span>';
        }
        if (value.startsWith("P")) {
          const paper = currentLiterature?.papers[Number(value.slice(1)) - 1];
          if (!paper) return escapeAttr(raw);
          const meta = [paper.journal, paper.year, LEVEL_LABEL[paper.level]].filter(Boolean).join(" · ");
          return `<a class="ev ev-paper" href="${escapeAttr(pubmedUrl(paper.pmid))}" target="_blank" rel="noopener noreferrer" title="${escapeAttr(`${paper.title} — ${meta}`)}">${value}</a>`;
        }
        if (value.startsWith("W")) {
          const hit = currentLiterature?.web[Number(value.slice(1)) - 1];
          if (!hit || !/^https?:\/\//i.test(hit.url)) return escapeAttr(raw);
          return `<a class="ev ev-web" href="${escapeAttr(hit.url)}" target="_blank" rel="noopener noreferrer" title="${escapeAttr(hit.title)}">${value}</a>`;
        }
        const note = currentNotes.get(Number(value));
        if (!note) return escapeAttr(raw);
        const href = `/entries/${encodeURIComponent(note.id)}`;
        if (!note.verified) {
          return `<a class="ev ev-ai" href="${href}" title="검토 전 BBIP 초안 — 노트 링크">AI</a>`;
        }
        if (note.book) {
          // Textbook-backed note: same numeral, linked to the claim; the
          // footnote list spells out the book and page.
          const anchor = note.book.claimId ? `#claim-${encodeURIComponent(note.book.claimId)}` : "";
          const page = note.book.page ? ` p.${note.book.page}` : "";
          return `<a class="ev ev-note" href="${href}${anchor}" title="${escapeAttr(`${note.title} — ${note.book.title}${page}`)}">${note.n}</a>`;
        }
        return `<a class="ev ev-note" href="${href}" title="${escapeAttr(note.title)}">${note.n}</a>`;
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
const EMPH_FIX = /((?:\s*\[(?:\d{1,2}|AI|[PW]\d{1,2})\])+)(\*{1,3}|_{1,3})(?=[^\s\p{P}])/gu;

export function renderEvidenceHtml(markdown: string, notes: NoteRef[], literature?: LiteratureBlock): string {
  currentNotes = new Map(notes.map((note) => [note.n, note]));
  currentLiterature = literature;
  try {
    return marked.parse(markdown.replace(EMPH_FIX, "$2$1")) as string;
  } finally {
    currentNotes = new Map();
    currentLiterature = undefined;
  }
}

/** 1-based P#/W# numbers cited in the text. */
export function citedLiterature(markdown: string): { papers: number[]; web: number[] } {
  const papers = new Set<number>();
  const web = new Set<number>();
  for (const match of markdown.matchAll(/\[([PW])(\d{1,2})\]/g)) {
    (match[1] === "P" ? papers : web).add(Number(match[2]));
  }
  const sorted = (set: Set<number>) => Array.from(set).sort((a, b) => a - b);
  return { papers: sorted(papers), web: sorted(web) };
}

export function citedNoteNumbers(markdown: string): number[] {
  const numbers = new Set<number>();
  for (const match of markdown.matchAll(MARKER)) {
    if (match[1] !== "AI") numbers.add(Number(match[1]));
  }
  return Array.from(numbers).sort((a, b) => a - b);
}

/** Plain note body for promotion: literature markers are spelled out
 * ("(PMID n)", "(host)"), note markers become relations (dropped from
 * text), AI markers — and markers of `unverified` notes (BBIP drafts) —
 * stay visible as "(AI 보충)". Only inter-word space runs are collapsed, so
 * list indentation and blank lines survive. */
export function toPlainNoteText(
  markdown: string,
  unverified: ReadonlySet<number> = new Set(),
  literature?: LiteratureBlock
): string {
  return markdown
    .replace(/[ \t]*\[([PW])(\d{1,2})\]/g, (_marker, kind: string, n: string) => {
      const index = Number(n) - 1;
      if (kind === "P") {
        const paper = literature?.papers[index];
        return paper ? ` (PMID ${paper.pmid})` : "";
      }
      const hit = literature?.web[index];
      return hit ? ` (${hostOf(hit.url) || hit.url})` : "";
    })
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
