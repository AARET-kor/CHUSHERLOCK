"use client";

import Link from "next/link";
import type { ClientTurn } from "../../lib/bbip/consoleState";
import { turnTitle } from "../../lib/bbip/sections";
import type { NoteRef } from "../../lib/bbip/types";
import { EvidenceMarkdown } from "./EvidenceMarkdown";

export function TurnCard({
  turn,
  notes,
  onRetry,
  onPromote,
}: {
  turn: ClientTurn;
  notes: NoteRef[];
  onRetry: (turn: ClientTurn) => void;
  onPromote: (turnId: string) => void;
}) {
  const streaming = turn.status === "streaming";
  return (
    <article
      aria-busy={streaming}
      className={`card animate-pop-in mt-4 p-5 ${turn.kind === "brief" ? "ring-2 ring-ink/10" : ""}`}
    >
      <header className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-ink">{turnTitle(turn)}</h2>
        {streaming && <span className="text-xs text-ink/60">생성 중…</span>}
      </header>

      {turn.output ? (
        <EvidenceMarkdown markdown={turn.output} notes={notes} />
      ) : streaming ? (
        <div className="dot-pulse flex items-center gap-1.5 text-sm text-ink/60">
          근거를 모으는 중 <span /> <span /> <span />
        </div>
      ) : null}

      {turn.status === "failed" && (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-red-700">
          <span role="alert">{turn.error ?? "생성에 실패했습니다."}</span>
          <button type="button" className="btn-secondary !px-4 !py-1.5" onClick={() => onRetry(turn)}>
            다시 시도
          </button>
        </div>
      )}

      {turn.status === "done" && turn.id && (
        <footer className="mt-4 flex justify-end">
          {turn.promotedEntryId ? (
            <Link
              href={`/entries/${turn.promotedEntryId}`}
              className="text-xs font-medium text-emerald-700 underline-offset-4 hover:underline"
            >
              ✓ 노트에 저장됨
            </Link>
          ) : (
            <button
              type="button"
              className="btn-secondary !px-4 !py-1.5 text-xs"
              onClick={() => onPromote(turn.id!)}
            >
              ＋ 노트로 저장
            </button>
          )}
        </footer>
      )}
    </article>
  );
}
