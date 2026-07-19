"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { MarkdownContent } from "./MarkdownContent";
import { schedule, dueLabel, type CardState, type Rating } from "../lib/srs/scheduler";

export interface ReviewCard {
  id: string;
  entryId: string;
  entryTitle: string;
  front: string;
  back: string;
  status: "learning" | "review" | "lapsed";
  learningStep: number;
  easeMilli: number;
  intervalDays: number;
  reps: number;
  lapses: number;
}

function toState(c: ReviewCard): CardState {
  return {
    status: c.status,
    learningStep: c.learningStep,
    easeMilli: c.easeMilli,
    intervalDays: c.intervalDays,
    reps: c.reps,
    lapses: c.lapses,
  };
}

const BUTTONS: { rating: Rating; label: string; key: string; className: string }[] = [
  { rating: "again", label: "다시", key: "1", className: "bg-red-500/90 hover:bg-red-500" },
  { rating: "hard", label: "어려움", key: "2", className: "bg-amber-500/90 hover:bg-amber-500" },
  { rating: "good", label: "보통", key: "3", className: "bg-emerald-600/90 hover:bg-emerald-600" },
  { rating: "easy", label: "쉬움", key: "4", className: "bg-sky-600/90 hover:bg-sky-600" },
];

export function ReviewClient({ initialCards }: { initialCards: ReviewCard[] }) {
  const router = useRouter();
  const [queue, setQueue] = useState<ReviewCard[]>(initialCards);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(0);
  const total = initialCards.length;

  const card = queue[0];

  const rate = useCallback(
    async (rating: Rating) => {
      if (!card || !flipped) return;
      const result = schedule(toState(card), rating);
      const requeue = result.dueInMinutes < 60; // learning cards come back this session

      // optimistic advance
      setQueue((q) => {
        const [head, ...rest] = q;
        return requeue && head ? [...rest, { ...head, ...result }] : rest;
      });
      if (!requeue) setDone((d) => d + 1);
      setFlipped(false);

      try {
        await fetch("/api/flashcards/review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cardId: card.id, rating }),
        });
      } catch {
        /* best-effort; the optimistic UI already advanced */
      }
    },
    [card, flipped]
  );

  // keyboard: space flips, 1-4 rates
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === " ") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (flipped) {
        const btn = BUTTONS.find((b) => b.key === e.key);
        if (btn) void rate(btn.rating);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flipped, rate]);

  const previews = useMemo(() => {
    if (!card) return {} as Record<Rating, string>;
    const out = {} as Record<Rating, string>;
    for (const b of BUTTONS) out[b.rating] = dueLabel(schedule(toState(card), b.rating).dueInMinutes);
    return out;
  }, [card]);

  if (!card) {
    return (
      <div className="animate-pop-in rounded-[24px] bg-inkdeep px-8 py-14 text-center text-white">
        <div className="mb-3 text-5xl">🎉</div>
        <h2 className="font-serifa text-2xl font-bold">복습 완료</h2>
        <p className="mt-2 text-sm text-white/60">
          {total > 0 ? `오늘 ${total}장을 복습했습니다. 다음 복습 때 다시 만나요.` : "지금 복습할 카드가 없습니다."}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={() => router.refresh()}
            className="rounded-full bg-white/10 px-5 py-2 text-sm transition hover:bg-white/20"
          >
            새로고침
          </button>
          <Link href="/study" className="rounded-full bg-white px-5 py-2 text-sm font-medium text-ink">
            학습 묶음으로
          </Link>
        </div>
      </div>
    );
  }

  const progress = total > 0 ? (done / total) * 100 : 0;

  return (
    <div>
      {/* progress */}
      <div className="mb-6">
        <div className="mb-1.5 flex items-center justify-between text-xs text-ink/50">
          <span>남은 카드 {queue.length}장</span>
          <span className="tabular-nums">
            {done} / {total}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-mist">
          <div
            className="h-full rounded-full bg-ink transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={card.id + String(flipped)}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        >
          <button
            type="button"
            onClick={() => setFlipped((f) => !f)}
            className="card block w-full cursor-pointer p-8 text-left transition-shadow hover:shadow-lg md:p-12"
          >
            <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-ink/40">
              <span>{flipped ? "답" : "질문"}</span>
              <span>·</span>
              <Link
                href={`/entries/${card.entryId}`}
                onClick={(e) => e.stopPropagation()}
                className="truncate hover:text-ink hover:underline"
              >
                {card.entryTitle}
              </Link>
              {card.status !== "review" && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] text-amber-700">
                  {card.status === "lapsed" ? "다시 학습" : "학습 중"}
                </span>
              )}
            </div>
            <div className="text-lg leading-relaxed text-inkdeep md:text-xl">
              <MarkdownContent content={card.front} />
            </div>
            {flipped && (
              <div className="mt-6 border-t border-ink/10 pt-6 text-base leading-relaxed text-ink/80">
                <MarkdownContent content={card.back} />
              </div>
            )}
            {!flipped && (
              <p className="mt-8 text-center text-xs text-ink/35">
                카드를 누르거나 Space를 눌러 답 보기
              </p>
            )}
          </button>
        </motion.div>
      </AnimatePresence>

      {flipped && (
        <div className="animate-fade-in-up mt-5 grid grid-cols-4 gap-2">
          {BUTTONS.map((b) => (
            <button
              key={b.rating}
              type="button"
              onClick={() => void rate(b.rating)}
              className={`flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-white transition ${b.className}`}
            >
              <span className="text-sm font-medium">{b.label}</span>
              <span className="text-[10px] text-white/75">{previews[b.rating]}</span>
              <span className="mt-0.5 hidden text-[9px] text-white/50 sm:block">[{b.key}]</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
