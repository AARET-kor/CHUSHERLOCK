"use client";

import { useMemo } from "react";
import { renderEvidenceHtml } from "../../lib/bbip/evidence";
import type { NoteRef } from "../../lib/bbip/types";

/** Markdown with [n]/[AI] markers rendered as evidence badges and
 * {{atlas:id}} tokens as anatomy-map chips. Raw HTML in the model output is
 * escaped inside renderEvidenceHtml. */
export function EvidenceMarkdown({
  markdown,
  notes,
  onAtlas,
}: {
  markdown: string;
  notes: NoteRef[];
  onAtlas?: (id: string) => void;
}) {
  const html = useMemo(() => renderEvidenceHtml(markdown, notes), [markdown, notes]);
  return (
    // Click delegation for the rendered chips (they are real <button>s, so
    // keyboard activation arrives here as a click too).
    <div
      className="note-body text-sm"
      onClick={(event) => {
        const chip = (event.target as HTMLElement).closest<HTMLElement>("[data-atlas]");
        const id = chip?.dataset.atlas;
        if (id && onAtlas) onAtlas(id);
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
