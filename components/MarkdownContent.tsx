import { marked } from "marked";
import { applyDecorations } from "../lib/codex/decorations";

/** Renders a note body (Markdown + decoration markers) with the .note-body
 * typography styles. Raw HTML in the source is escaped before parsing, so
 * only Markdown-born markup and our own decoration tags reach the DOM. */
export function MarkdownContent({ content }: { content: string }) {
  // Escape & and < only — that neutralizes raw HTML injection, while a bare
  // ">" must survive so Markdown blockquotes ("> 한눈에 보기") still parse.
  const escaped = content.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const html = applyDecorations(marked.parse(escaped, { breaks: true, async: false }) as string, "class");

  return <div className="note-body text-sm" dangerouslySetInnerHTML={{ __html: html }} />;
}
