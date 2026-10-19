"use client";

import { useMemo } from "react";
import { renderEvidenceHtml } from "../../lib/bbip/evidence";
import type { NoteRef } from "../../lib/bbip/types";

/** Markdown with [n]/[AI] markers rendered as footnote superscripts. Raw HTML
 * in the model output is escaped inside renderEvidenceHtml. */
export function EvidenceMarkdown({ markdown, notes }: { markdown: string; notes: NoteRef[] }) {
  const html = useMemo(() => renderEvidenceHtml(markdown, notes), [markdown, notes]);
  return <div className="bbip-prose" dangerouslySetInnerHTML={{ __html: html }} />;
}
