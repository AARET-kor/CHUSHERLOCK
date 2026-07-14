"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, MotionConfig } from "motion/react";
import type { ContentTier } from "../lib/codex/types";
import { TierBadge } from "./TierBadge";

export interface StudyCluster {
  id: string;
  title: string;
  description: string;
  suggestions: string[];
  entries: Array<{ id: string; title: string; tier: ContentTier; digest: string }>;
}

const EASE = [0.16, 1, 0.3, 1] as const;

export function StudyClient({ clusters }: { clusters: StudyCluster[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function rebuild() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/study/rebuild", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "생성에 실패했습니다.");
        return;
      }
      setMessage(
        `${data.clusterCount}개 묶음 · 노트 ${data.groupedNotes}/${data.totalNotes}개가 연결되었습니다.`
      );
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serifa text-2xl font-bold tracking-tight text-inkdeep">
            학습 <span className="italic">묶음</span>
          </h1>
          <p className="mt-1 max-w-xl text-sm text-ink/60">
            AI가 노트들을 함께 공부하면 좋은 단위로 묶고, 학습 순서와 연계 학습 주제까지
            제안합니다. 노트를 추가한 뒤 다시 묶어 최신 상태로 유지하세요.
          </p>
        </div>
        <button
          type="button"
          onClick={rebuild}
          disabled={busy}
          className="btn-primary !px-5 !py-2.5"
        >
          {busy ? (
            <span className="dot-pulse inline-flex items-center gap-1">
              묶는 중 <span /> <span /> <span />
            </span>
          ) : clusters.length > 0 ? (
            "다시 묶기"
          ) : (
            "학습 묶음 만들기"
          )}
        </button>
      </div>

      {message && (
        <p className="animate-pop-in mb-6 rounded-xl bg-mist/70 px-3 py-2 text-xs text-ink/70">
          {message}
        </p>
      )}

      {clusters.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink/15 bg-mist/40 p-12 text-center">
          <p className="text-sm text-ink/50">
            아직 학습 묶음이 없습니다.
            <br />
            노트가 2개 이상 있으면 <strong className="text-ink/70">학습 묶음 만들기</strong>로 연결할 수 있어요.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {clusters.map((cluster, ci) => (
            <motion.section
              key={cluster.id}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: EASE, delay: Math.min(ci, 6) * 0.06 }}
              className="card overflow-hidden"
            >
              <div className="border-b border-ink/5 bg-gradient-to-br from-inkdeep to-ink px-6 py-5 text-white">
                <div className="mb-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-white/40">
                  <span>학습 묶음 {ci + 1}</span>
                  <span>·</span>
                  <span>노트 {cluster.entries.length}개</span>
                </div>
                <h2 className="font-serifa text-lg font-bold">{cluster.title}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-white/70">{cluster.description}</p>
              </div>

              {/* Ordered study path */}
              <ol className="divide-y divide-ink/5">
                {cluster.entries.map((entry, i) => (
                  <li key={entry.id}>
                    <Link
                      href={`/entries/${entry.id}`}
                      className="group flex items-start gap-4 px-6 py-4 transition-colors hover:bg-mist/50"
                    >
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-mist text-xs font-semibold tabular-nums text-ink/60 transition-colors group-hover:bg-ink group-hover:text-white">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <TierBadge tier={entry.tier} />
                          <span className="font-medium text-ink group-hover:underline">
                            {entry.title}
                          </span>
                        </span>
                        <span className="mt-1 line-clamp-1 block text-xs text-ink/50">
                          {entry.digest}
                        </span>
                      </span>
                      <span className="mt-1 text-ink/25 transition-transform group-hover:translate-x-0.5 group-hover:text-ink/60">
                        →
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>

              {cluster.suggestions.length > 0 && (
                <div className="border-t border-ink/5 bg-mist/30 px-6 py-4">
                  <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-ink/40">
                    🔗 다음으로 공부하면 좋은 것
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {cluster.suggestions.map((s, i) => (
                      <span
                        key={i}
                        className="rounded-full border border-ink/15 bg-white px-3 py-1 text-xs text-ink/70"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </motion.section>
          ))}
        </div>
      )}
    </MotionConfig>
  );
}
