"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { ClientTurn } from "../../lib/bbip/consoleState";
import { citedNoteNumbers } from "../../lib/bbip/evidence";
import type { NoteRef } from "../../lib/bbip/types";
import { EvidenceMarkdown } from "./EvidenceMarkdown";

/** One written section of the sheet: body, its footnotes, and the quiet
 * actions underneath. The heading lives in the sheet's margin column. */
export function TurnCard({
  turn,
  notes,
  title,
  onRetry,
  onPromote,
}: {
  turn: ClientTurn;
  notes: NoteRef[];
  /** In-body title (questions); section names live in the margin. */
  title?: string;
  onRetry: (turn: ClientTurn) => void;
  onPromote: (turnId: string) => void;
}) {
  const streaming = turn.status === "streaming";
  const done = turn.status === "done" && turn.id;

  const cited = useMemo(() => {
    const numbers = new Set(citedNoteNumbers(turn.output));
    return notes.filter((n) => numbers.has(n.n));
  }, [turn.output, notes]);
  const hasAi = /\[AI\]/.test(turn.output) || cited.some((n) => !n.verified);

  return (
    <article aria-busy={streaming} className="min-w-0">
      {title && (
        <h3 className="mb-4 break-keep font-serifa text-[20px] font-bold leading-snug text-inkdeep sm:text-[22px]">
          {title}
        </h3>
      )}

      {turn.output && <EvidenceMarkdown markdown={turn.output} notes={notes} />}
      {streaming && (
        <p className="bbip-caret mt-1 text-[12px] text-ink/50">
          {turn.output ? "작성 중" : "근거를 모으는 중"}
        </p>
      )}

      {turn.status === "failed" && (
        <p role="alert" className="mt-3 text-[13.5px] leading-relaxed text-red-800">
          {turn.error ?? "생성에 실패했습니다."}{" "}
          <button
            type="button"
            onClick={() => onRetry(turn)}
            className="ml-1 font-semibold text-ink underline decoration-ink/30 underline-offset-4 hover:decoration-ink"
          >
            다시 시도
          </button>
        </p>
      )}

      {done && (
        <footer className="mt-6 flex flex-col gap-4 border-t border-ink/10 pt-4 sm:flex-row sm:items-start sm:justify-between">
          <ol className="min-w-0 space-y-1.5 text-[12.5px] leading-snug text-ink/70">
            {cited.map((note) => (
              <li key={note.id} className="flex gap-2.5">
                <span
                  className={`w-5 shrink-0 text-right font-mono text-[11px] ${
                    note.verified ? "text-[#0f5132]" : "italic text-[#8a5a00]"
                  }`}
                >
                  {note.verified ? note.n : "AI"}
                </span>
                <span className="min-w-0">
                  <Link href={`/entries/${note.id}`} className="text-ink underline-offset-4 hover:underline">
                    {note.title}
                  </Link>
                  <span className="text-ink/45"> · {note.categoryLabel}</span>
                  {!note.verified && <span className="italic text-[#8a5a00]"> · 검토 전 초안</span>}
                </span>
              </li>
            ))}
            {hasAi && (
              <li className="flex gap-2.5">
                <span className="w-5 shrink-0 text-right font-mono text-[11px] italic text-[#8a5a00]">AI</span>
                <span>내 노트에 없는 일반 지식 — 수치·용량은 IFU와 허가사항으로 확인하세요.</span>
              </li>
            )}
          </ol>
          <div className="shrink-0">
            {turn.promotedEntryId ? (
              <Link
                href={`/entries/${turn.promotedEntryId}`}
                className="whitespace-nowrap text-[12.5px] font-medium text-[#0f5132] underline decoration-[#0f5132]/30 underline-offset-4 hover:decoration-[#0f5132]"
              >
                노트에 저장됨 →
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => onPromote(turn.id!)}
                className="whitespace-nowrap text-[12.5px] font-medium text-ink underline decoration-ink/30 underline-offset-4 transition hover:decoration-ink"
              >
                노트로 저장
              </button>
            )}
          </div>
        </footer>
      )}
    </article>
  );
}
