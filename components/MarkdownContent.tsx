import { marked } from "marked";
import { applyDecorations } from "../lib/codex/decorations";

/** Renders a note body (Markdown + decoration markers) with the .note-body
 * typography styles. Raw HTML in the source is escaped before parsing, so
 * only Markdown-born markup and our own decoration tags reach the DOM. */
export function MarkdownContent({ content }: { content: string }) {
  const escaped = content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const html = applyDecorations(marked.parse(escaped, { breaks: true, async: false }) as string, "class");

  return <div className="note-body text-sm" dangerouslySetInnerHTML={{ __html: html }} />;
}
