"use client";

import { ExternalLink } from "lucide-react";
import { authorsShort, hostOf, LEVEL_LABEL, pubmedUrl } from "../../lib/bbip/literature/refs";
import type { LiteratureBlock, LitLevel } from "../../lib/bbip/types";

const LEVEL_TONE: Record<LitLevel, string> = {
  guideline: "bg-emerald-100 text-emerald-900",
  meta: "bg-emerald-50 text-emerald-800",
  rct: "bg-sky-50 text-sky-800",
  observational: "bg-mist text-ink/80",
  case: "bg-amber-50 text-amber-900",
  other: "bg-stone-100 text-stone-700",
};

/** Reference list under the 문헌 근거 card: evidence level per paper, links,
 * the queries used and any provider failure. */
export function LiteratureRefs({ block }: { block: LiteratureBlock }) {
  return (
    <div className="mt-5 border-t border-ink/[0.07] pt-4">
      <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.18em] text-ink/65">References</p>
      <ol className="space-y-2 text-xs">
        {block.papers.map((paper, i) => (
          <li key={paper.pmid} className="flex gap-2">
            <span className="ev ev-paper shrink-0">🔬P{i + 1}</span>
            <div className="min-w-0">
              <a
                href={pubmedUrl(paper.pmid)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-inkdeep underline-offset-2 hover:underline"
              >
                {paper.title}
              </a>
              <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-ink/65">
                <span className={`rounded-full px-1.5 py-px text-[10px] font-semibold ${LEVEL_TONE[paper.level]}`}>
                  {LEVEL_LABEL[paper.level]}
                </span>
                <span>{[authorsShort(paper.authors), paper.journal, paper.year].filter(Boolean).join(" · ")}</span>
                <span>PMID {paper.pmid}</span>
              </p>
            </div>
          </li>
        ))}
        {block.web.map((hit, i) => (
          <li key={hit.url} className="flex gap-2">
            <span className="ev ev-web shrink-0">🌐W{i + 1}</span>
            <div className="min-w-0">
              <a
                href={hit.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-inkdeep underline-offset-2 hover:underline"
              >
                {hit.title}
                <ExternalLink aria-hidden="true" className="h-3 w-3 shrink-0" />
              </a>
              <p className="mt-0.5 text-ink/65">{hostOf(hit.url)}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-3 break-words font-mono text-[10px] text-ink/60">
        PubMed: {block.pubmedQuery || "—"} · Web: {block.webQuery || "—"}
      </p>
      {(block.errors.pubmed || block.errors.web) && (
        <p className="mt-1 text-[11px] text-amber-800">
          {[block.errors.pubmed, block.errors.web].filter(Boolean).join(" ")} 다른 출처 결과로 정리했습니다.
        </p>
      )}
    </div>
  );
}
