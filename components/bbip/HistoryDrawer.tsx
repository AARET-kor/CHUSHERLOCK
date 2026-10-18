"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { chipSummary, formatSessionTime } from "../../lib/bbip/format";
import type { BbipSession } from "../../lib/bbip/types";

export function HistoryDrawer({ activeId }: { activeId: string | null }) {
  const [sessions, setSessions] = useState<BbipSession[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/bbip/sessions")
      .then((res) => (res.ok ? res.json() : { sessions: [] }))
      .then((data: { sessions: BbipSession[] }) => {
        if (!cancelled) setSessions(data.sessions);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  const list = (
    <nav aria-label="최근 케이스">
      <Link
        href="/"
        className="mb-3 block rounded-xl bg-ink px-3 py-2 text-center text-xs font-medium text-white"
      >
        ＋ 새 케이스
      </Link>
      <ul className="space-y-1">
        {sessions.map((session) => (
          <li key={session.id}>
            <Link
              href={`/?s=${session.id}`}
              aria-current={session.id === activeId ? "page" : undefined}
              className={`block rounded-lg px-3 py-2 text-xs transition hover:bg-mist ${
                session.id === activeId ? "bg-mist font-medium" : "text-ink/80"
              }`}
            >
              <span className="block truncate">{chipSummary(session.chips) || "케이스"}</span>
              <span className="text-[10px] text-ink/60">{formatSessionTime(session.createdAt)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );

  return (
    <>
      <aside className="hidden w-56 shrink-0 lg:block">{list}</aside>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-secondary fixed bottom-24 right-4 z-40 !px-4 !py-2 text-xs lg:hidden"
      >
        🕘 히스토리
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="최근 케이스"
          className="fixed inset-0 z-50 bg-black/30 lg:hidden"
          onClick={() => setOpen(false)}
        >
          <div
            className="absolute inset-y-0 left-0 w-72 overflow-y-auto bg-white p-4"
            onClick={(e) => e.stopPropagation()}
          >
            {list}
          </div>
        </div>
      )}
    </>
  );
}
