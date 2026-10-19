"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BookImage, X } from "lucide-react";
import type { AnatomyFigure } from "../../../lib/bbip/anatomy/figures";

/** 📖 Figures from the doctor's own material attached to this session's notes. */
export function MyFigures({ sessionId }: { sessionId: string }) {
  const [figures, setFigures] = useState<AnatomyFigure[]>([]);
  const [open, setOpen] = useState<AnatomyFigure | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/bbip/sessions/${sessionId}/figures`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : { figures: [] }))
      .then((data) => setFigures(Array.isArray(data.figures) ? data.figures : []))
      .catch(() => {
        /* aborted or offline: the section just stays hidden */
      });
    return () => controller.abort();
  }, [sessionId]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  if (figures.length === 0) return null;

  return (
    <div className="mt-6">
      <p className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/65">
        <BookImage aria-hidden="true" className="h-3.5 w-3.5" />
        내 자료 그림 · {figures.length}
      </p>
      <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {figures.map((figure) => (
          <li key={figure.id}>
            <button
              type="button"
              onClick={() => setOpen(figure)}
              className="group block w-full overflow-hidden rounded-2xl bg-mist text-left ring-1 ring-ink/[0.07] transition hover:ring-ink/25"
            >
              <img
                src={`/api/figures/${figure.id}`}
                alt={figure.caption}
                loading="lazy"
                className="aspect-[4/3] w-full bg-white object-contain"
              />
              <span className="line-clamp-2 block px-2.5 py-2 text-[11px] leading-snug text-ink/80">
                {figure.caption}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialogRef}
        aria-label={open?.caption ?? "그림"}
        onClose={() => setOpen(null)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setOpen(null);
        }}
        className="w-[min(92vw,880px)] rounded-[24px] p-0 backdrop:bg-inkdeep/60"
      >
        {open && (
          <div className="p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <p className="text-sm font-medium text-inkdeep">{open.caption}</p>
              <button
                type="button"
                onClick={() => setOpen(null)}
                aria-label="닫기"
                className="rounded-full p-1.5 text-ink/60 transition hover:bg-ink/5 hover:text-ink"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
            <img src={`/api/figures/${open.id}`} alt={open.caption} className="max-h-[70vh] w-full object-contain" />
            <Link
              href={`/entries/${open.entryId}`}
              className="mt-3 inline-flex rounded-full bg-ink px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-inkdeep"
            >
              원 노트 열기 — {open.entryTitle}
            </Link>
          </div>
        )}
      </dialog>
    </div>
  );
}
