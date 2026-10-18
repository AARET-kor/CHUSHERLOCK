"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, MotionConfig } from "motion/react";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Layers3,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  WandSparkles,
  X,
} from "lucide-react";
import type { ContentTier } from "../lib/codex/types";
import { TierBadge } from "./TierBadge";

export interface StudyCluster {
  id: string;
  title: string;
  description: string;
  suggestions: string[];
  origin: "ai" | "manual";
  cardCount: number;
  dueCount: number;
  masteredCount: number;
  cardReadyNotes: number;
  estimatedMinutes: number;
  preview: { front: string; entryTitle: string } | null;
  entries: Array<{
    id: string;
    title: string;
    tier: ContentTier;
    digest: string;
    cardCount: number;
    dueCount: number;
    masteredCount: number;
  }>;
}

export interface StudyNote {
  id: string;
  title: string;
  categoryLabel: string;
  tier: ContentTier;
}

const EASE = [0.16, 1, 0.3, 1] as const;
type DeckFilter = "all" | "due" | "build";

export function StudyClient({
  clusters,
  allNotes,
}: {
  clusters: StudyCluster[];
  allNotes: StudyNote[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [editor, setEditor] = useState<StudyCluster | "new" | null>(null);
  const [cardBusyId, setCardBusyId] = useState<string | null>(null);
  const [cardProgress, setCardProgress] = useState({ current: 0, total: 0 });
  const [filter, setFilter] = useState<DeckFilter>("all");

  const totalDue = useMemo(() => clusters.reduce((sum, c) => sum + c.dueCount, 0), [clusters]);
  const totalCards = useMemo(() => clusters.reduce((sum, c) => sum + c.cardCount, 0), [clusters]);
  const priorityCluster = useMemo(
    () =>
      [...clusters].sort(
        (a, b) =>
          b.dueCount - a.dueCount ||
          a.cardReadyNotes / Math.max(1, a.entries.length) -
            b.cardReadyNotes / Math.max(1, b.entries.length)
      )[0] ?? null,
    [clusters]
  );
  const filteredClusters = useMemo(
    () =>
      clusters.filter((cluster) => {
        if (filter === "due") return cluster.dueCount > 0;
        if (filter === "build") return cluster.cardReadyNotes < cluster.entries.length;
        return true;
      }),
    [clusters, filter]
  );

  async function rebuild() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/study/rebuild", { method: "POST" });
      const data = await res.json();
      if (!res.ok) return setMessage(data.error ?? "생성에 실패했습니다.");
      setMessage(
        `AI가 ${data.clusterCount}개 묶음 · 노트 ${data.groupedNotes}/${data.totalNotes}개를 연결했습니다. (수동 묶음은 유지됨)`
      );
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function deleteCluster(id: string) {
    if (!confirm("이 학습 묶음을 삭제할까요? 노트 자체는 삭제되지 않습니다.")) return;
    await fetch(`/api/clusters/${id}`, { method: "DELETE" });
    router.refresh();
  }

  /** Generate flashcards for every note in a cluster, then jump to review. */
  async function studyAsCards(cluster: StudyCluster) {
    setCardBusyId(cluster.id);
    setCardProgress({ current: 0, total: cluster.entries.length });
    setMessage(null);
    try {
      let created = 0;
      for (const [index, e] of cluster.entries.entries()) {
        const res = await fetch("/api/flashcards/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entryId: e.id }),
        });
        const data = await res.json().catch(() => ({}));
        created += data.created ?? 0;
        setCardProgress({ current: index + 1, total: cluster.entries.length });
      }
      setMessage(
        created > 0
          ? `${cluster.title}에 새 카드 ${created}장을 준비했습니다. 바로 복습을 시작합니다.`
          : "이미 카드가 준비되어 있습니다. 오늘 복습으로 이동합니다."
      );
      router.push(`/review?clusterId=${encodeURIComponent(cluster.id)}`);
    } finally {
      setCardBusyId(null);
      setCardProgress({ current: 0, total: 0 });
    }
  }

  return (
    <MotionConfig reducedMotion="user">
      <section className="mb-8 overflow-hidden rounded-[28px] bg-inkdeep text-white shadow-[0_24px_70px_rgba(5,26,36,0.16)]">
        <div className="grid gap-8 px-6 py-7 md:grid-cols-[1.3fr_0.7fr] md:px-8 md:py-9">
          <div className="flex min-w-0 flex-col justify-between">
            <div>
              <div className="mb-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-white/55">
                <Layers3 aria-hidden="true" className="h-3.5 w-3.5" />
                <span>Chunk study desk</span>
              </div>
              <h1 className="max-w-2xl font-serifa text-3xl font-bold leading-tight tracking-tight md:text-[38px]">
                읽을 것은 잘게 묶고,
                <br />
                기억할 것은 <span className="italic text-[#bfe7d1]">카드로.</span>
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/62">
                노트의 학습 순서와 플래시카드 상태를 한 덱에서 확인하세요. 오늘 할 만큼만
                시작하고, 다음 복습은 간격 반복이 이어줍니다.
              </p>
            </div>

            <div className="mt-7 flex flex-wrap gap-2.5">
              {priorityCluster ? (
                priorityCluster.dueCount > 0 ? (
                  <Link
                    href={`/review?clusterId=${encodeURIComponent(priorityCluster.id)}`}
                    className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-ink transition hover:-translate-y-0.5 hover:shadow-lg"
                  >
                    <Play aria-hidden="true" className="h-4 w-4 fill-current" />
                    오늘 {priorityCluster.dueCount}장 복습
                  </Link>
                ) : (
                  <Link
                    href={`/entries/${priorityCluster.entries[0]?.id ?? ""}`}
                    className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-ink transition hover:-translate-y-0.5 hover:shadow-lg"
                  >
                    <BookOpen aria-hidden="true" className="h-4 w-4" />
                    다음 묶음 읽기
                  </Link>
                )
              ) : (
                <button
                  type="button"
                  onClick={() => setEditor("new")}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-ink transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <Plus aria-hidden="true" className="h-4 w-4" />
                  첫 학습 덱 만들기
                </button>
              )}
              <button
                type="button"
                onClick={rebuild}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-full border border-white/18 bg-white/8 px-4 py-2.5 text-sm text-white/82 transition hover:bg-white/14 disabled:opacity-50"
              >
                {busy ? (
                  <RefreshCw aria-hidden="true" className="h-4 w-4 animate-spin" />
                ) : (
                  <WandSparkles aria-hidden="true" className="h-4 w-4" />
                )}
                {busy ? "묶는 중" : clusters.some((c) => c.origin === "ai") ? "AI 다시 묶기" : "AI로 묶기"}
              </button>
            </div>
          </div>

          <div className="rounded-[22px] border border-white/10 bg-white/[0.065] p-5 backdrop-blur">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/65">
                Today&apos;s desk
              </p>
              <span className="rounded-full bg-[#bfe7d1] px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-wider text-ink">
                Live
              </span>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3">
              <HeroStat label="오늘 복습" value={totalDue} unit="장" accent />
              <HeroStat label="학습 덱" value={clusters.length} unit="개" />
              <HeroStat label="전체 카드" value={totalCards} unit="장" />
            </div>
            <div className="mt-5 border-t border-white/10 pt-4">
              <p className="text-[11px] text-white/65">가장 먼저 할 일</p>
              {priorityCluster ? (
                <div className="mt-2 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{priorityCluster.title}</p>
                    <p className="mt-1 text-xs text-white/68">
                      {priorityCluster.dueCount > 0
                        ? `지금 복습할 카드 ${priorityCluster.dueCount}장`
                        : `노트 ${priorityCluster.entries.length}개 · 약 ${priorityCluster.estimatedMinutes}분`}
                    </p>
                  </div>
                  <ArrowRight aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-white/65" />
                </div>
              ) : (
                <p className="mt-2 text-sm leading-relaxed text-white/68">
                  노트를 고르거나 AI 큐레이션으로 첫 학습 덱을 만들어 보세요.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink/65">
            <span>[ MY DECKS ]</span>
            <span>학습 묶음 {clusters.length}</span>
          </div>
          <h2 className="font-serifa text-2xl font-bold tracking-tight text-inkdeep">
            지금 쓸 수 있는 <span className="italic">학습 덱</span>
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-full bg-mist p-1" aria-label="학습 덱 필터">
            <FilterButton active={filter === "all"} onClick={() => setFilter("all")}>
              전체 {clusters.length}
            </FilterButton>
            <FilterButton active={filter === "due"} onClick={() => setFilter("due")}>
              복습 {clusters.filter((c) => c.dueCount > 0).length}
            </FilterButton>
            <FilterButton active={filter === "build"} onClick={() => setFilter("build")}>
              카드 준비 {clusters.filter((c) => c.cardReadyNotes < c.entries.length).length}
            </FilterButton>
          </div>
          <button
            type="button"
            onClick={() => setEditor("new")}
            className="btn-secondary inline-flex items-center gap-1.5 !px-4 !py-2.5"
          >
            <Plus aria-hidden="true" className="h-3.5 w-3.5" />
            새 덱
          </button>
        </div>
      </div>

      {message && (
        <p
          className="animate-pop-in mb-6 rounded-xl border border-ink/5 bg-mist/70 px-4 py-3 text-xs text-ink/70"
          role="status"
          aria-live="polite"
        >
          {message}
        </p>
      )}

      {clusters.length === 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          <button
            type="button"
            onClick={rebuild}
            disabled={busy}
            className="group rounded-[24px] border border-ink/10 bg-white p-6 text-left shadow-[0_16px_45px_rgba(5,26,36,0.06)] transition hover:-translate-y-1 hover:border-ink/20"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-white">
              <Sparkles aria-hidden="true" className="h-4.5 w-4.5" />
            </span>
            <span className="mt-5 block font-serifa text-lg font-bold text-inkdeep">AI가 학습 흐름 만들기</span>
            <span className="mt-2 block text-sm leading-relaxed text-ink/68">
              관련 노트를 찾아 이해하기 좋은 순서로 묶고, 함께 공부할 이유까지 정리합니다.
            </span>
            <span className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-ink">
              {busy ? "분석 중" : "내 노트 자동 큐레이션"}
              <ArrowRight aria-hidden="true" className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
            </span>
          </button>
          <button
            type="button"
            onClick={() => setEditor("new")}
            className="group rounded-[24px] border border-ink/10 bg-[#f4f0e8] p-6 text-left shadow-[0_16px_45px_rgba(5,26,36,0.04)] transition hover:-translate-y-1 hover:border-ink/20"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-ink shadow-sm">
              <Plus aria-hidden="true" className="h-4.5 w-4.5" />
            </span>
            <span className="mt-5 block font-serifa text-lg font-bold text-inkdeep">직접 나만의 덱 만들기</span>
            <span className="mt-2 block text-sm leading-relaxed text-ink/68">
              시험, 케이스, 시술 주제처럼 지금 필요한 노트만 고르고 학습 순서를 직접 정합니다.
            </span>
            <span className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-ink">
              노트 선택하기
              <ArrowRight aria-hidden="true" className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
            </span>
          </button>
        </div>
      ) : filteredClusters.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-ink/15 bg-mist/35 px-6 py-10 text-center">
          <CheckCircle2 aria-hidden="true" className="mx-auto h-6 w-6 text-emerald-600" />
          <p className="mt-3 text-sm font-medium text-inkdeep">
            {filter === "due" ? "지금 복습할 덱이 없습니다." : "모든 덱의 카드가 준비되어 있습니다."}
          </p>
          <button
            type="button"
            onClick={() => setFilter("all")}
            className="mt-3 text-xs font-semibold text-ink/68 underline underline-offset-4 hover:text-ink"
          >
            전체 덱 보기
          </button>
        </div>
      ) : (
        <div className="space-y-7">
          {filteredClusters.map((cluster, ci) => {
            const readiness = Math.round(
              (cluster.cardReadyNotes / Math.max(1, cluster.entries.length)) * 100
            );
            const missingCards = Math.max(0, cluster.entries.length - cluster.cardReadyNotes);
            const firstEntry = cluster.entries[0];
            const primaryHref =
              cluster.dueCount > 0
                ? `/review?clusterId=${encodeURIComponent(cluster.id)}`
                : firstEntry
                  ? `/entries/${firstEntry.id}`
                  : "/study";

            return (
            <motion.section
              key={cluster.id}
              id={`cluster-${cluster.id}`}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE, delay: Math.min(ci, 6) * 0.05 }}
              className="overflow-hidden rounded-[26px] border border-ink/10 bg-white shadow-[0_20px_55px_rgba(5,26,36,0.07)]"
            >
              <div className="grid md:grid-cols-[minmax(0,1.35fr)_minmax(260px,0.65fr)]">
                <div className="min-w-0 border-b border-ink/7 p-5 md:border-b-0 md:border-r md:p-7">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="mb-3 flex flex-wrap items-center gap-2 font-mono text-[9px] uppercase tracking-[0.17em] text-ink/65">
                        <span className="rounded-full border border-ink/10 bg-mist/55 px-2.5 py-1 text-ink/70">
                          Deck {String(clusters.indexOf(cluster) + 1).padStart(2, "0")}
                        </span>
                        <span>{cluster.origin === "manual" ? "Handpicked" : "AI curated"}</span>
                      </div>
                      <h3 className="font-serifa text-xl font-bold leading-snug text-inkdeep md:text-[22px]">
                        {cluster.title}
                      </h3>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => setEditor(cluster)}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-ink/38 transition hover:bg-mist hover:text-ink"
                        title="학습 덱 편집"
                        aria-label={`${cluster.title} 편집`}
                      >
                        <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteCluster(cluster.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-ink/28 transition hover:bg-red-50 hover:text-red-600"
                        title="학습 덱 삭제"
                        aria-label={`${cluster.title} 삭제`}
                      >
                        <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {cluster.description && (
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink/68">
                      {cluster.description}
                    </p>
                  )}

                  <div className="mt-5 flex flex-wrap gap-2">
                    <DeckMeta icon={<BookOpen className="h-3.5 w-3.5" />} label={`노트 ${cluster.entries.length}`} />
                    <DeckMeta icon={<Layers3 className="h-3.5 w-3.5" />} label={`카드 ${cluster.cardCount}`} />
                    <DeckMeta
                      icon={<Clock3 className="h-3.5 w-3.5" />}
                      label={`약 ${cluster.estimatedMinutes}분`}
                    />
                    {cluster.dueCount > 0 && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1.5 text-[11px] font-semibold text-emerald-800">
                        <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
                        지금 {cluster.dueCount}장 복습
                      </span>
                    )}
                  </div>

                  <div className="mt-6">
                    <div className="mb-2 flex items-center justify-between text-[11px]">
                      <span className="font-medium text-ink/70">플래시카드 준비</span>
                      <span className="font-mono text-ink/65">
                        {cluster.cardReadyNotes}/{cluster.entries.length} notes · {readiness}%
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-mist">
                      <div
                        className="h-full rounded-full bg-ink transition-all duration-500"
                        style={{ width: `${readiness}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-2.5">
                    {cluster.dueCount > 0 ? (
                      <Link
                        href={primaryHref}
                        className="btn-primary inline-flex items-center gap-2 !px-5 !py-2.5"
                      >
                        <Play aria-hidden="true" className="h-3.5 w-3.5 fill-current" />
                        오늘 {cluster.dueCount}장 복습
                      </Link>
                    ) : missingCards > 0 ? (
                      <button
                        type="button"
                        onClick={() => studyAsCards(cluster)}
                        disabled={cardBusyId === cluster.id}
                        className="btn-primary inline-flex items-center gap-2 !px-5 !py-2.5 disabled:opacity-55"
                      >
                        {cardBusyId === cluster.id ? (
                          <RefreshCw aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
                        )}
                        {cardBusyId === cluster.id
                          ? `카드 준비 ${cardProgress.current}/${cardProgress.total}`
                          : `카드 준비하고 시작 · ${missingCards}노트`}
                      </button>
                    ) : (
                      <Link
                        href={primaryHref}
                        className="btn-primary inline-flex items-center gap-2 !px-5 !py-2.5"
                      >
                        <BookOpen aria-hidden="true" className="h-3.5 w-3.5" />
                        노트로 다시 보기
                      </Link>
                    )}
                    {firstEntry && (
                      <Link
                        href={`/entries/${firstEntry.id}`}
                        className="btn-secondary inline-flex items-center gap-2 !px-4 !py-2.5"
                      >
                        학습 순서 열기
                        <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
                      </Link>
                    )}
                  </div>
                </div>

                <div className="relative overflow-hidden bg-[#f3efe6] p-5 md:p-7">
                  <div className="mb-3 flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.18em] text-ink/65">
                    <span>Flashcard preview</span>
                    <span>{cluster.cardCount > 0 ? `${cluster.cardCount} cards` : "New deck"}</span>
                  </div>
                  <div className="flex min-h-[220px] flex-col rounded-[19px] border border-ink/10 bg-white p-5 shadow-[0_14px_35px_rgba(5,26,36,0.09)]">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink/65">
                        Question
                      </span>
                      <span className="max-w-[145px] truncate rounded-full bg-mist px-2 py-1 text-[9px] text-ink/68">
                        {cluster.preview?.entryTitle ?? "첫 카드"}
                      </span>
                    </div>
                    <div className="flex flex-1 items-center">
                      <p className="font-serifa text-base font-bold leading-relaxed text-inkdeep">
                        {cluster.preview?.front ??
                          "이 묶음의 핵심을 질문으로 바꾸면, 읽은 내용을 실제로 꺼내보는 연습이 시작됩니다."}
                      </p>
                    </div>
                    <div className="flex items-center justify-between border-t border-ink/8 pt-3 text-[10px] text-ink/65">
                      <span>{cluster.preview ? "답은 복습에서 확인" : "카드 준비 후 바로 복습"}</span>
                      <RefreshCw aria-hidden="true" className="h-3 w-3" />
                    </div>
                  </div>
                  {cluster.masteredCount > 0 && (
                    <p className="mt-3 flex items-center gap-1.5 text-[10px] font-medium text-emerald-700">
                      <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />
                      장기 간격에 들어간 카드 {cluster.masteredCount}장
                    </p>
                  )}
                </div>
              </div>

              <div className="border-t border-ink/7 px-5 py-4 md:px-7">
                <div className="mb-3 flex items-center justify-between">
                  <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink/65">
                    Study route · 학습 순서
                  </p>
                  <span className="text-[10px] text-ink/65">위에서 아래로 진행</span>
                </div>
                <ol className="grid gap-2 md:grid-cols-2">
                {cluster.entries.map((entry, i) => (
                  <li key={entry.id} className="min-w-0">
                    <Link
                      href={`/entries/${entry.id}`}
                      className="group flex min-h-[74px] items-start gap-3 rounded-xl border border-ink/7 bg-white px-3.5 py-3 transition hover:border-ink/16 hover:bg-mist/40"
                    >
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-mist font-mono text-[10px] font-semibold tabular-nums text-ink/70 transition-colors group-hover:bg-ink group-hover:text-white">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex min-w-0 items-center gap-2">
                          <TierBadge tier={entry.tier} />
                          <span className="truncate text-xs font-semibold text-ink group-hover:underline">
                            {entry.title}
                          </span>
                        </span>
                        <span className="mt-1.5 line-clamp-1 block text-[11px] text-ink/65">
                          {entry.digest}
                        </span>
                      </span>
                      <span
                        className={`mt-0.5 shrink-0 rounded-full px-2 py-1 font-mono text-[8px] uppercase tracking-wide ${
                          entry.dueCount > 0
                            ? "bg-emerald-100 text-emerald-800"
                            : entry.cardCount > 0
                              ? "bg-mist text-ink/68"
                              : "border border-dashed border-ink/15 text-ink/65"
                        }`}
                      >
                        {entry.dueCount > 0
                          ? `Due ${entry.dueCount}`
                          : entry.cardCount > 0
                            ? `${entry.cardCount} cards`
                            : "No cards"}
                      </span>
                    </Link>
                  </li>
                ))}
                </ol>
              </div>

              {cluster.suggestions.length > 0 && (
                <div className="border-t border-ink/7 bg-mist/25 px-5 py-4 md:px-7">
                  <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.18em] text-ink/65">
                    Next connection · 다음 학습
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {cluster.suggestions.map((s, i) => (
                      <span
                        key={i}
                        className="rounded-full border border-ink/10 bg-white px-3 py-1.5 text-[11px] text-ink/70"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </motion.section>
          );
          })}
        </div>
      )}

      {editor && (
        <ClusterEditor
          existing={editor === "new" ? null : editor}
          allNotes={allNotes}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            router.refresh();
          }}
        />
      )}
    </MotionConfig>
  );
}

function HeroStat({
  label,
  value,
  unit,
  accent,
}: {
  label: string;
  value: number;
  unit: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div className={`font-serifa text-2xl font-bold tabular-nums ${accent ? "text-[#bfe7d1]" : "text-white"}`}>
        {value}
        <span className="ml-1 text-[10px] font-normal text-white/65">{unit}</span>
      </div>
      <div className="mt-1 text-[10px] text-white/65">{label}</div>
    </div>
  );
}

function DeckMeta({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-ink/8 bg-mist/45 px-3 py-1.5 text-[11px] text-ink/70">
      <span aria-hidden="true">{icon}</span>
      {label}
    </span>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition ${
        active ? "bg-white text-ink shadow-sm" : "text-ink/65 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

/** Create/edit modal: title, description, and an ordered note set built from
 * a searchable picker (add / remove / reorder). */
function ClusterEditor({
  existing,
  allNotes,
  onClose,
  onSaved,
}: {
  existing: StudyCluster | null;
  allNotes: StudyNote[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [selected, setSelected] = useState<StudyNote[]>(
    existing
      ? existing.entries
          .map((e) => allNotes.find((n) => n.id === e.id))
          .filter((n): n is StudyNote => Boolean(n))
      : []
  );
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedIds = useMemo(() => new Set(selected.map((n) => n.id)), [selected]);
  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allNotes
      .filter((n) => !selectedIds.has(n.id))
      .filter((n) => !q || n.title.toLowerCase().includes(q) || n.categoryLabel.toLowerCase().includes(q))
      .slice(0, 40);
  }, [allNotes, selectedIds, query]);

  function move(idx: number, dir: -1 | 1) {
    setSelected((s) => {
      const next = [...s];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return s;
      [next[idx], next[j]] = [next[j]!, next[idx]!];
      return next;
    });
  }

  async function save() {
    if (selected.length === 0) return setError("노트를 하나 이상 선택해 주세요.");
    setSaving(true);
    setError(null);
    try {
      const payload = {
        title: title.trim() || "새 학습 묶음",
        description: description.trim(),
        entryIds: selected.map((n) => n.id),
      };
      const res = existing
        ? await fetch(`/api/clusters/${existing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/clusters", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setError(data.error ?? "저장에 실패했습니다.");
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="animate-pop-in flex max-h-[85vh] w-full max-w-2xl flex-col rounded-[24px] bg-white p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink/38">
              {existing ? "Edit study deck" : "New study deck"}
            </p>
            <h3 className="mt-1 font-serifa text-lg font-bold text-inkdeep">
              {existing ? "학습 덱 편집" : "직접 학습 덱 만들기"}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink/38 transition hover:bg-mist hover:text-ink"
            aria-label="닫기"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="묶음 제목 (예: 필러 혈관 합병증 — 예방부터 응급까지)"
          className="field mt-3"
        />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="설명 (선택) — 왜 함께 보는지"
          className="field mt-2"
        />

        <div className="mt-4 grid min-h-0 flex-1 gap-3 sm:grid-cols-2">
          {/* selected, ordered */}
          <div className="flex min-h-0 flex-col">
            <p className="mb-1.5 font-mono text-[10px] uppercase tracking-widest text-ink/40">
              선택된 노트 · 학습 순서 ({selected.length})
            </p>
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto rounded-xl border border-ink/10 p-2">
              {selected.length === 0 && (
                <p className="p-4 text-center text-xs text-ink/35">오른쪽에서 노트를 골라 추가</p>
              )}
              {selected.map((n, i) => (
                <div
                  key={n.id}
                  className="flex items-center gap-1.5 rounded-lg bg-mist/60 px-2 py-1.5 text-xs"
                >
                  <span className="w-4 shrink-0 text-center tabular-nums text-ink/40">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-ink/80">{n.title}</span>
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    className="flex h-6 w-6 items-center justify-center rounded text-ink/40 hover:bg-white hover:text-ink"
                    title="위로"
                    aria-label={`${n.title} 위로 이동`}
                  >
                    <ChevronUp aria-hidden="true" className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    className="flex h-6 w-6 items-center justify-center rounded text-ink/40 hover:bg-white hover:text-ink"
                    title="아래로"
                    aria-label={`${n.title} 아래로 이동`}
                  >
                    <ChevronDown aria-hidden="true" className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelected((s) => s.filter((x) => x.id !== n.id))}
                    className="flex h-6 w-6 items-center justify-center rounded text-ink/40 hover:bg-red-50 hover:text-red-500"
                    title="제거"
                    aria-label={`${n.title} 제거`}
                  >
                    <X aria-hidden="true" className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* picker */}
          <div className="flex min-h-0 flex-col">
            <div className="relative mb-1.5">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/32"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="노트 검색…"
                className="field !py-1.5 !pl-8 text-xs"
              />
            </div>
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto rounded-xl border border-ink/10 p-2">
              {candidates.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => setSelected((s) => [...s, n])}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition hover:bg-mist"
                >
                  <Plus aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-ink/40" />
                  <span className="min-w-0 flex-1 truncate text-ink/80">{n.title}</span>
                  <span className="shrink-0 text-[10px] text-ink/35">{n.categoryLabel}</span>
                </button>
              ))}
              {candidates.length === 0 && (
                <p className="p-4 text-center text-xs text-ink/35">결과 없음</p>
              )}
            </div>
          </div>
        </div>

        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary !px-4 !py-2">
            취소
          </button>
          <button type="button" onClick={save} disabled={saving} className="btn-primary !px-5 !py-2">
            {saving ? "저장 중…" : existing ? "저장" : "만들기"}
          </button>
        </div>
      </div>
    </div>
  );
}
