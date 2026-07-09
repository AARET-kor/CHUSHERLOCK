import { marked } from "marked";

/** Renders a note body (Markdown) with the .note-body typography styles.
 * Raw HTML in the source is escaped before parsing, so only Markdown-born
 * markup reaches the DOM. */
export function MarkdownContent({ content }: { content: string }) {
  const escaped = content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const html = marked.parse(escaped, { breaks: true, async: false });

  return <div className="note-body text-sm" dangerouslySetInnerHTML={{ __html: html }} />;
}
