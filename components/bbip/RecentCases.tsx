"use client";

import Link from "next/link";
import { ArrowRight, History } from "lucide-react";
import { chipSummary, formatSessionTime } from "../../lib/bbip/format";
import type { BbipSession } from "../../lib/bbip/types";

const EXAMPLES = [
  "20대 여성, 여드름 흉터, 이소트레티노인 복용, 레이저 문의",
  "30대 남성, 사각턱, 보톡스 처음",
  "50대 여성, 팔자주름, 와파린 복용, 필러 상담",
];

/** Glass panel in the console hero: the five latest cases, a new-case link,
 * the full-history drawer trigger and (before any case) example inputs. */
export function RecentCases({
  sessions,
  activeId,
  showExamples,
  onExample,
  onOpenHistory,
}: {
  sessions: BbipSession[];
  activeId: string | null;
  showExamples: boolean;
  onExample: (input: string) => void;
  onOpenHistory: () => void;
}) {
  const recent = sessions.slice(0, 5);

  return (
    <div className="flex min-w-0 flex-col rounded-[22px] border border-white/10 bg-white/[0.065] p-5 backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/65">Recent cases</p>
        <Link
          href="/"
          className="shrink-0 whitespace-nowrap rounded-full bg-[#bfe7d1] px-3 py-1 text-[11px] font-semibold text-ink transition hover:bg-white"
        >
          ＋ 새 케이스
        </Link>
      </div>

      <nav aria-label="최근 케이스" className="mt-4">
        {recent.length === 0 ? (
          <p className="text-sm leading-relaxed text-white/65">
            아직 케이스가 없습니다. 첫 케이스를 넣으면 여기에 쌓입니다.
          </p>
        ) : (
          <ul className="-mx-2 space-y-0.5">
            {recent.map((session) => {
              const active = session.id === activeId;
              return (
                <li key={session.id}>
                  <Link
                    href={`/?s=${session.id}`}
                    aria-current={active ? "page" : undefined}
                    className={`group flex items-center justify-between gap-3 rounded-xl px-2 py-2 transition hover:bg-white/10 ${
                      active ? "bg-white/10" : ""
                    }`}
                  >
                    <span className="min-w-0">
                      <span
                        className={`block truncate text-sm ${active ? "font-semibold text-white" : "text-white/85"}`}
                      >
                        {chipSummary(session.chips) || "케이스"}
                      </span>
                      <span className="font-mono text-[10px] text-white/55">
                        {formatSessionTime(session.createdAt)}
                      </span>
                    </span>
                    <ArrowRight
                      aria-hidden="true"
                      className="h-3.5 w-3.5 shrink-0 text-white/40 transition group-hover:translate-x-0.5 group-hover:text-white/80"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </nav>

      {showExamples && (
        <div className="mt-5 border-t border-white/10 pt-4">
          <p className="text-[11px] text-white/65">예시로 시작하기</p>
          <div className="mt-2 flex flex-col items-start gap-1.5">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => onExample(example)}
                className="max-w-full truncate rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-left text-xs text-white/80 transition hover:bg-white/15 hover:text-white"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      )}

      {sessions.length > 0 && (
        <button
          type="button"
          onClick={onOpenHistory}
          className="mt-auto inline-flex items-center gap-1.5 self-start pt-4 text-xs font-medium text-white/70 underline-offset-4 transition hover:text-white hover:underline"
        >
          <History aria-hidden="true" className="h-3.5 w-3.5" />
          전체 히스토리
        </button>
      )}
    </div>
  );
}
