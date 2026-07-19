"use client";

import { useMemo, useState } from "react";
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
  origin: "ai" | "manual";
  entries: Array<{ id: string; title: string; tier: ContentTier; digest: string }>;
}

export interface StudyNote {
  id: string;
  title: string;
  categoryLabel: string;
  tier: ContentTier;
}

const EASE = [0.16, 1, 0.3, 1] as const;

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
    setMessage(null);
    try {
      let created = 0;
      for (const e of cluster.entries) {
        const res = await fetch("/api/flashcards/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entryId: e.id }),
        });
        const data = await res.json().catch(() => ({}));
        created += data.created ?? 0;
      }
      router.push("/review");
    } finally {
      setCardBusyId(null);
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
            함께 공부하면 좋은 노트를 하나의 학습 단위로 묶습니다. AI가 자동으로 묶어주고, 직접
            만들거나 수정할 수도 있어요. 묶음을 <strong className="text-ink/80">카드로 학습</strong>하면
            간격 반복(Anki식)으로 외울 수 있습니다.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setEditor("new")}
            className="btn-secondary !px-4 !py-2.5"
          >
            + 직접 묶기
          </button>
          <button type="button" onClick={rebuild} disabled={busy} className="btn-primary !px-5 !py-2.5">
            {busy ? (
              <span className="dot-pulse inline-flex items-center gap-1">
                묶는 중 <span /> <span /> <span />
              </span>
            ) : clusters.some((c) => c.origin === "ai") ? (
              "AI 다시 묶기"
            ) : (
              "AI로 묶기"
            )}
          </button>
        </div>
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
            <strong className="text-ink/70">AI로 묶기</strong>로 자동 생성하거나,{" "}
            <strong className="text-ink/70">직접 묶기</strong>로 원하는 노트를 골라 만들어 보세요.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {clusters.map((cluster, ci) => (
            <motion.section
              key={cluster.id}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE, delay: Math.min(ci, 6) * 0.05 }}
              className="card overflow-hidden"
            >
              <div className="border-b border-ink/5 bg-gradient-to-br from-inkdeep to-ink px-6 py-5 text-white">
                <div className="mb-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-white/40">
                  <span className="rounded-full bg-white/10 px-2 py-0.5 normal-case tracking-normal">
                    {cluster.origin === "manual" ? "✋ 수동" : "✨ AI"}
                  </span>
                  <span>노트 {cluster.entries.length}개</span>
                </div>
                <h2 className="font-serifa text-lg font-bold">{cluster.title}</h2>
                {cluster.description && (
                  <p className="mt-1.5 text-sm leading-relaxed text-white/70">{cluster.description}</p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => studyAsCards(cluster)}
                    disabled={cardBusyId === cluster.id}
                    className="rounded-full bg-white px-4 py-1.5 text-xs font-medium text-ink transition hover:scale-105 disabled:opacity-50"
                  >
                    {cardBusyId === cluster.id ? "카드 만드는 중…" : "🎴 카드로 학습"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditor(cluster)}
                    className="rounded-full border border-white/25 px-4 py-1.5 text-xs text-white/80 transition hover:border-white/60"
                  >
                    편집
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteCluster(cluster.id)}
                    className="rounded-full border border-white/15 px-4 py-1.5 text-xs text-white/50 transition hover:border-red-300 hover:text-red-200"
                  >
                    삭제
                  </button>
                </div>
              </div>

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
        <h3 className="font-serifa text-lg font-bold text-inkdeep">
          {existing ? "학습 묶음 편집" : "직접 학습 묶음 만들기"}
        </h3>
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
                    className="px-1 text-ink/40 hover:text-ink"
                    title="위로"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    className="px-1 text-ink/40 hover:text-ink"
                    title="아래로"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelected((s) => s.filter((x) => x.id !== n.id))}
                    className="px-1 text-ink/40 hover:text-red-500"
                    title="제거"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* picker */}
          <div className="flex min-h-0 flex-col">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="노트 검색…"
              className="field mb-1.5 !py-1.5 text-xs"
            />
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto rounded-xl border border-ink/10 p-2">
              {candidates.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => setSelected((s) => [...s, n])}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition hover:bg-mist"
                >
                  <span className="text-ink/40">+</span>
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
