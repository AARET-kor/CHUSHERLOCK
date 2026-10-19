"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { AnatomyFigure } from "../../../lib/bbip/anatomy/figures";

/** Figures from the doctor's own material attached to this session's notes. */
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
    <div className="mt-8 border-t border-ink/10 pt-5">
      <p className="mb-3 font-serifa text-[17px] font-bold text-inkdeep">
        내 자료 그림 <span className="font-sans text-[14px] font-normal text-ink/65">{figures.length}점</span>
      </p>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {figures.map((figure) => (
          <li key={figure.id}>
            <button
              type="button"
              onClick={() => setOpen(figure)}
              className="group block w-full text-left"
            >
              <img
                src={`/api/figures/${figure.id}`}
                alt={figure.caption}
                loading="lazy"
                className="aspect-[4/3] w-full border border-ink/10 bg-white object-contain transition group-hover:border-ink/30"
              />
              <span className="mt-1.5 line-clamp-2 block text-[14px] leading-snug text-ink/75">
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
        className="w-[min(92vw,880px)] border border-ink/20 p-0 backdrop:bg-inkdeep/40"
      >
        {open && (
          <div className="p-5">
            <div className="mb-3 flex items-start justify-between gap-3">
              <p className="font-serifa text-[17px] font-bold text-inkdeep">{open.caption}</p>
              <button
                type="button"
                onClick={() => setOpen(null)}
                className="shrink-0 text-[14.5px] text-ink/70 underline decoration-ink/30 underline-offset-4 hover:text-ink"
              >
                닫기
              </button>
            </div>
            <img src={`/api/figures/${open.id}`} alt={open.caption} className="max-h-[70vh] w-full object-contain" />
            <Link
              href={`/entries/${open.entryId}`}
              className="mt-4 inline-block text-[14.5px] font-medium text-ink underline decoration-ink/30 underline-offset-4 hover:decoration-ink"
            >
              원 노트 열기: {open.entryTitle}
            </Link>
          </div>
        )}
      </dialog>
    </div>
  );
}
