"use client";

import { useMemo } from "react";
import { citedLiterature } from "../../lib/bbip/evidence";
import { authorsShort, hostOf, LEVEL_LABEL, pubmedUrl } from "../../lib/bbip/literature/refs";
import type { LiteratureBlock, TurnRequest } from "../../lib/bbip/types";

// 🔬 literature pieces of the consult sheet, kept out of the shared sheet
// components: TurnCard, MoreMenu and BbipConsole only mount these.

/** Footnote list entries for the P#/W# a card cites (inside TurnCard's <ol>). */
export function LiteratureFootnoteItems({
  markdown,
  literature,
}: {
  markdown: string;
  literature?: LiteratureBlock;
}) {
  const cited = useMemo(() => citedLiterature(markdown), [markdown]);
  if (!literature) return null;
  const papers = cited.papers.flatMap((n) => {
    const paper = literature.papers[n - 1];
    return paper ? [{ n, paper }] : [];
  });
  const web = cited.web.flatMap((n) => {
    const hit = literature.web[n - 1];
    return hit && /^https?:\/\//i.test(hit.url) ? [{ n, hit }] : [];
  });
  return (
    <>
      {papers.map(({ n, paper }) => (
        <li key={`P${n}`} className="flex gap-2.5">
          <span className="w-5 shrink-0 text-right font-mono text-[11px] text-[#1d4e89]">P{n}</span>
          <span className="min-w-0">
            <a
              href={pubmedUrl(paper.pmid)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-ink underline-offset-4 hover:underline"
            >
              {paper.title}
            </a>
            <span className="text-ink/65">
              {" · "}
              {[authorsShort(paper.authors), paper.journal, paper.year].filter(Boolean).join(", ")}
              {" · "}
            </span>
            <span className="font-medium text-[#1d4e89]">{LEVEL_LABEL[paper.level]}</span>
          </span>
        </li>
      ))}
      {web.map(({ n, hit }) => (
        <li key={`W${n}`} className="flex gap-2.5">
          <span className="w-5 shrink-0 text-right font-mono text-[11px] text-[#5b3a8c]">W{n}</span>
          <span className="min-w-0">
            <a href={hit.url} target="_blank" rel="noopener noreferrer" className="text-ink underline-offset-4 hover:underline">
              {hit.title}
            </a>
            <span className="text-ink/65"> · {hostOf(hit.url)}</span>
          </span>
        </li>
      ))}
    </>
  );
}

/** Queries used and any provider that failed — under the 문헌 근거 card. */
export function LiteratureSearchNote({ block }: { block: LiteratureBlock }) {
  const failed = [block.errors.pubmed, block.errors.web].filter(Boolean);
  return (
    <p className="mt-4 break-words text-[12px] leading-relaxed text-ink/65">
      검색어 — PubMed: <span className="font-mono text-[11px]">{block.pubmedQuery || "없음"}</span> · 웹:{" "}
      <span className="font-mono text-[11px]">{block.webQuery || "없음"}</span>
      {failed.length > 0 && (
        <span className="text-[#8a5a00]"> · {failed.join(" ")} 다른 출처 결과로 정리했습니다.</span>
      )}
    </p>
  );
}

/** One more row in MoreMenu's index: runs only when pressed. */
export function LiteratureIndexItem({
  opened,
  onRequest,
}: {
  opened: boolean;
  onRequest: (request: TurnRequest) => void;
}) {
  return (
    <div className="mt-7">
      <p className="mb-1 text-[11.5px] font-medium text-ink/65">문헌</p>
      <button
        type="button"
        disabled={opened}
        onClick={() => onRequest({ kind: "literature" })}
        className="group flex w-full items-baseline justify-between gap-3 border-b border-ink/[0.08] py-2.5 text-left transition disabled:cursor-default"
      >
        <span className="text-[14.5px] text-ink underline-offset-4 group-hover:underline group-disabled:text-ink/35 group-disabled:no-underline">
          문헌 근거 찾기
          <span className="ml-2 text-[12px] text-ink/65 group-disabled:text-ink/35">PubMed · 의학 웹, 누를 때만 검색</span>
        </span>
        <span aria-hidden="true" className="font-mono text-[11px] text-ink/30 transition group-hover:text-ink">
          {opened ? "열림" : "→"}
        </span>
      </button>
    </div>
  );
}

/** Literature runs search + card on its own endpoint. */
export function turnEndpoint(sessionId: string, request: TurnRequest): { url: string; body: string } {
  return request.kind === "literature"
    ? { url: `/api/bbip/sessions/${sessionId}/literature`, body: "{}" }
    : { url: `/api/bbip/sessions/${sessionId}/turns`, body: JSON.stringify(request) };
}
