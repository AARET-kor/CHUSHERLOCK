"use client";

import { useMemo } from "react";
import { renderEvidenceHtml } from "../../lib/bbip/evidence";
import type { LiteratureBlock, NoteRef } from "../../lib/bbip/types";

/** Markdown with [n]/[P#]/[W#]/[AI] markers rendered as evidence badges.
 * Raw HTML in the model output is escaped inside renderEvidenceHtml. */
export function EvidenceMarkdown({
  markdown,
  notes,
  literature,
}: {
  markdown: string;
  notes: NoteRef[];
  literature?: LiteratureBlock;
}) {
  const html = useMemo(() => renderEvidenceHtml(markdown, notes, literature), [markdown, notes, literature]);
  return <div className="note-body text-sm" dangerouslySetInnerHTML={{ __html: html }} />;
}
