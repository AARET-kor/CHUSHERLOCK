"use client";

import Link from "next/link";
import { History, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { chipSummary, formatSessionTime } from "../../lib/bbip/format";
import type { BbipSession } from "../../lib/bbip/types";

/** Full case history as a left drawer (native modal <dialog>), plus the
 * mobile FAB that opens it. The recent-cases list on desktop lives in the
 * console hero; this drawer holds the complete list. */
export function HistoryDrawer({
  sessions,
  activeId,
  open,
  onOpenChange,
}: {
  sessions: BbipSession[];
  activeId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Native modal dialog: top layer, focus trap and Escape come for free.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && dialog && !dialog.open) dialog.showModal();
  }, [open]);

  // Closing through the element (not just unmounting) restores focus to the
  // opener; the resulting "close" event then updates the parent state.
  function close() {
    if (dialogRef.current?.open) dialogRef.current.close();
    else onOpenChange(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        className="btn-secondary fixed bottom-24 right-4 z-40 !px-4 !py-2 text-xs lg:hidden"
      >
        <History aria-hidden="true" className="h-3.5 w-3.5" />
        히스토리
      </button>
      {open && (
        <dialog
          ref={dialogRef}
          aria-label="전체 히스토리"
          onClose={() => onOpenChange(false)}
          onClick={(e) => {
            // Backdrop click (the dialog element itself) closes the drawer.
            if (e.target === e.currentTarget) close();
          }}
          className="fixed inset-y-0 left-0 m-0 h-full max-h-none w-80 max-w-[85vw] overflow-y-auto bg-white p-0 shadow-[0_24px_70px_rgba(5,26,36,0.25)] backdrop:bg-inkdeep/40"
        >
          <div className="min-h-full p-5 pb-24">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/65">[ History ]</p>
                <h2 className="font-serifa text-xl font-bold text-inkdeep">
                  전체 <span className="italic">케이스</span>
                </h2>
              </div>
              <button
                type="button"
                onClick={close}
                className="inline-flex items-center gap-1 rounded-full bg-mist px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-ink/10"
              >
                <X aria-hidden="true" className="h-3.5 w-3.5" />
                닫기
              </button>
            </div>
            <nav
              aria-label="전체 히스토리"
              onClick={(e) => {
                if ((e.target as HTMLElement).closest("a")) close();
              }}
            >
              <Link
                href="/"
                className="mb-4 flex items-center justify-center gap-1.5 rounded-full bg-ink px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-inkdeep"
              >
                ＋ 새 케이스
              </Link>
              {sessions.length === 0 ? (
                <p className="px-1 text-xs text-ink/65">아직 저장된 케이스가 없습니다.</p>
              ) : (
                <ul className="space-y-1">
                  {sessions.map((session) => {
                    const active = session.id === activeId;
                    return (
                      <li key={session.id}>
                        <Link
                          href={`/?s=${session.id}`}
                          aria-current={active ? "page" : undefined}
                          className={`block rounded-2xl px-3 py-2.5 transition hover:bg-mist ${
                            active ? "bg-mist" : ""
                          }`}
                        >
                          <span
                            className={`block truncate text-sm ${active ? "font-semibold text-inkdeep" : "text-ink/80"}`}
                          >
                            {chipSummary(session.chips) || "케이스"}
                          </span>
                          <span className="font-mono text-[10px] text-ink/65">
                            {formatSessionTime(session.createdAt)}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </nav>
          </div>
        </dialog>
      )}
    </>
  );
}
