"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CategoryDef } from "../lib/codex/types";
import { CONTENT_TIERS } from "../lib/codex/tiers";
import { previewOverlapsAction } from "../lib/actions/entryActions";
import type { OverlapCandidate } from "../lib/codex/overlap";
import { EditorToolbar } from "./EditorToolbar";

const SOURCE_TYPES = [
  "paper",
  "textbook",
  "book",
  "course",
  "manufacturer_guideline",
  "personal_note",
  "website",
  "other",
] as const;

interface SourceDraft {
  type: (typeof SOURCE_TYPES)[number];
  citation: string;
  url: string;
  authors: string;
  year: string;
}

function emptySource(): SourceDraft {
  return { type: "paper", citation: "", url: "", authors: "", year: "" };
}

export function EntryForm({ leafCategories }: { leafCategories: CategoryDef[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [categoryKey, setCategoryKey] = useState(leafCategories[0]?.key ?? "");
  const [tier, setTier] = useState(CONTENT_TIERS[0]!.id);
  const [sources, setSources] = useState<SourceDraft[]>([emptySource()]);
  const [overlaps, setOverlaps] = useState<Array<OverlapCandidate & { similarity: number }>>([]);
  const [isChecking, startCheck] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const contentRef = useRef<HTMLTextAreaElement | null>(null);

  const parsedSources = useMemo(
    () =>
      sources
        .filter((s) => s.citation.trim())
        .map((s) => ({
          type: s.type,
          citation: s.citation.trim(),
          url: s.url.trim() || undefined,
          authors: s.authors.trim() || undefined,
          year: s.year.trim() ? Number(s.year.trim()) : undefined,
        })),
    [sources]
  );

  function checkOverlap(nextTitle: string, nextCategoryKey: string) {
    startCheck(async () => {
      const result = await previewOverlapsAction(nextTitle, nextCategoryKey);
      setOverlaps(result);
    });
  }

  function updateSource(index: number, patch: Partial<SourceDraft>) {
    setSources((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          content,
          categoryKey,
          tier,
          tags: tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          sources: parsedSources,
          relatedEntryIds: [],
          status: "draft",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "저장에 실패했습니다.");
        setFieldErrors(data.fieldErrors ?? {});
        return;
      }

      router.push(`/entries/${data.entry.id}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between rounded-xl border border-dashed border-ink/15 bg-mist/50 px-3 py-2 text-xs text-ink/50">
        <span>원문(논문/교과서/PDF 등)을 통째로 넣으면 AI가 읽고 분류해 줍니다.</span>
        <a
          href="/"
          className="rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-emerald-800 hover:border-emerald-500"
        >
          AI 자동 분류로 이동
        </a>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">제목 (Title)</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => checkOverlap(title, categoryKey)}
          className="field"
          placeholder="예: 안와상동맥 위치와 필러 시술 시 위험 구역"
        />
        {fieldErrors.title && <p className="mt-1 text-xs text-red-600">{fieldErrors.title}</p>}
      </div>

      {overlaps.length > 0 && (
        <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">
          <p className="mb-1 font-medium text-amber-800">
            {isChecking ? "확인 중..." : "비슷한 기존 자료가 있습니다. 저장 시 자동으로 연결됩니다."}
          </p>
          <ul className="list-inside list-disc text-amber-700">
            {overlaps.map((o) => (
              <li key={o.id}>
                {o.title} (유사도 {(o.similarity * 100).toFixed(0)}%)
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">카테고리 (Category)</label>
          <select
            value={categoryKey}
            onChange={(e) => {
              setCategoryKey(e.target.value);
              checkOverlap(title, e.target.value);
            }}
            className="field"
          >
            {leafCategories.map((c) => (
              <option key={c.key} value={c.key}>
                {c.labelKo} / {c.labelEn}
              </option>
            ))}
          </select>
          {fieldErrors.categoryKey && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.categoryKey}</p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">난이도/성격 (Tier)</label>
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value as typeof tier)}
            className="field"
          >
            {CONTENT_TIERS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.labelKo} / {t.labelEn}
              </option>
            ))}
          </select>
          {fieldErrors.tier && <p className="mt-1 text-xs text-red-600">{fieldErrors.tier}</p>}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">내용 (Content, 한글+영어 혼용 가능)</label>
        <div className="mb-2">
          <EditorToolbar
            target={{ textareaRef: contentRef, value: content, onChange: setContent }}
          />
        </div>
        <textarea
          ref={contentRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={12}
          className="field font-mono"
          placeholder={
            "지나치게 축약하지 말고, 이해하기 쉽게 한글+영어를 섞어서 정리하세요.\n" +
            "예: Onset은 보통 24-72시간 이내 (usually within 24-72 hours)..."
          }
        />
        {fieldErrors.content && <p className="mt-1 text-xs text-red-600">{fieldErrors.content}</p>}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">태그 (쉼표로 구분)</label>
        <input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          className="field"
          placeholder="예: filler, vascular-occlusion, emergency-protocol"
        />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="block text-sm font-medium">출처 (Sources) — 최소 1건 필수</label>
          <button
            type="button"
            onClick={() => setSources((prev) => [...prev, emptySource()])}
            className="text-xs text-emerald-700 hover:underline"
          >
            + 출처 추가
          </button>
        </div>
        <div className="space-y-3">
          {sources.map((source, index) => (
            <div key={index} className="grid gap-2 rounded border border-ink/10 p-3 sm:grid-cols-4">
              <select
                value={source.type}
                onChange={(e) => updateSource(index, { type: e.target.value as SourceDraft["type"] })}
                className="field !px-2 !py-1"
              >
                {SOURCE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <input
                value={source.citation}
                onChange={(e) => updateSource(index, { citation: e.target.value })}
                placeholder="citation (필수)"
                className="field !px-2 !py-1 sm:col-span-2"
              />
              <input
                value={source.year}
                onChange={(e) => updateSource(index, { year: e.target.value })}
                placeholder="연도"
                className="field !px-2 !py-1"
              />
              <input
                value={source.authors}
                onChange={(e) => updateSource(index, { authors: e.target.value })}
                placeholder="저자"
                className="field !px-2 !py-1 sm:col-span-2"
              />
              <input
                value={source.url}
                onChange={(e) => updateSource(index, { url: e.target.value })}
                placeholder="URL (선택)"
                className="field !px-2 !py-1 sm:col-span-2"
              />
            </div>
          ))}
        </div>
        {fieldErrors.sources && <p className="mt-1 text-xs text-red-600">{fieldErrors.sources}</p>}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="btn-primary"
      >
        {isSubmitting ? "저장 중..." : "저장하고 정리하기"}
      </button>
    </form>
  );
}
