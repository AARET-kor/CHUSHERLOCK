"use client";

import Link from "next/link";
import { LoaderCircle, RotateCcw } from "lucide-react";
import type { ClientTurn } from "../../lib/bbip/consoleState";
import { getSection } from "../../lib/bbip/sections";
import type { NoteRef } from "../../lib/bbip/types";
import { EvidenceMarkdown } from "./EvidenceMarkdown";
import { GROUP_LABELS, turnIcon } from "./icons";

function cardHeading(turn: ClientTurn): { kicker: string; title: string } {
  if (turn.kind === "brief") return { kicker: "Core brief", title: "핵심 브리핑" };
  if (turn.kind === "section" && turn.sectionKey) {
    const section = getSection(turn.sectionKey);
    return { kicker: `Section · ${GROUP_LABELS[section.group].ko}`, title: section.label };
  }
  return {
    kicker: turn.kind === "followup" ? "Follow-up" : "Your question",
    title: turn.question ?? "질문",
  };
}

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
  const brief = turn.kind === "brief";
  const Icon = turnIcon(turn);
  const { kicker, title } = cardHeading(turn);

  return (
    <article
      aria-busy={streaming}
      className={`animate-pop-in overflow-hidden border bg-white ${
        brief
          ? "rounded-[26px] border-ink/15 shadow-[0_24px_60px_rgba(5,26,36,0.09)]"
          : "rounded-[24px] border-ink/10 shadow-[0_16px_45px_rgba(5,26,36,0.06)]"
      }`}
    >
      <header
        className={`flex items-start justify-between gap-3 border-b border-ink/[0.07] px-5 py-4 md:px-6 ${
          brief ? "bg-[#f4f0e8]" : ""
        }`}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-white">
            <Icon aria-hidden="true" className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink/65">{kicker}</p>
            <h3
              className={`break-words font-serifa font-bold leading-snug text-inkdeep ${
                brief ? "text-xl" : "text-lg"
              }`}
            >
              {title}
            </h3>
          </div>
        </div>
        {streaming && (
          <span className="mt-1 inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] text-ink/70 ring-1 ring-ink/10">
            <LoaderCircle aria-hidden="true" className="h-3 w-3 animate-spin" />
            생성 중…
          </span>
        )}
      </header>

      <div className={`px-5 py-5 md:px-6 ${brief ? "md:py-6" : ""}`}>
        {turn.output ? (
          <EvidenceMarkdown markdown={turn.output} notes={notes} />
        ) : streaming ? (
          <div className="dot-pulse flex items-center gap-1.5 text-sm text-ink/65">
            근거를 모으는 중 <span /> <span /> <span />
          </div>
        ) : null}

        {turn.status === "failed" && (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200">
            <span role="alert" className="min-w-0 flex-1">
              {turn.error ?? "생성에 실패했습니다."}
            </span>
            <button
              type="button"
              className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-ink ring-1 ring-ink/10 transition hover:ring-ink/30"
              onClick={() => onRetry(turn)}
            >
              <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
              다시 시도
            </button>
          </div>
        )}
      </div>

      {turn.status === "done" && turn.id && (
        <footer className="flex items-center justify-between gap-3 border-t border-ink/[0.07] px-5 py-3 md:px-6">
          <p className="hidden text-[11px] text-ink/65 sm:block">
            <span className="ev ev-note">📚</span> 내 노트 근거 · <span className="ev ev-ai">🤖AI</span> 검증 전 보충
          </p>
          {turn.promotedEntryId ? (
            <Link
              href={`/entries/${turn.promotedEntryId}`}
              className="ml-auto whitespace-nowrap rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200 transition hover:bg-emerald-100"
            >
              ✓ 노트에 저장됨
            </Link>
          ) : (
            <button
              type="button"
              className="ml-auto whitespace-nowrap rounded-full bg-ink px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-inkdeep"
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
