"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CategoryDef } from "../lib/codex/types";
import { CATEGORY_TAXONOMY } from "../lib/codex/taxonomy";
import { CONTENT_TIERS } from "../lib/codex/tiers";
import { previewOverlapsAction } from "../lib/actions/entryActions";
import type { OverlapCandidate } from "../lib/codex/overlap";
import { EditorToolbar } from "./EditorToolbar";

const SOURCE_TYPES = [
  { value: "personal_note", label: "개인 노트/경험" },
  { value: "course", label: "강의/세미나" },
  { value: "paper", label: "논문" },
  { value: "textbook", label: "교과서" },
  { value: "manufacturer_guideline", label: "제조사 가이드" },
  { value: "website", label: "웹사이트" },
  { value: "other", label: "기타" },
] as const;

/** 진료 사이에 30초 만에 남기는 빠른 메모가 기본 흐름: 내용부터 쓰고,
 * 나머지(제목/출처/태그)는 비워도 알아서 채워진다. 긴 원문은 대시보드의
 * AI 인제스트가 담당하므로 여기서 다루지 않는다. */
export function EntryForm({ leafCategories }: { leafCategories: CategoryDef[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [categoryKey, setCategoryKey] = useState(leafCategories[0]?.key ?? "");
  const [tier, setTier] = useState(CONTENT_TIERS[0]!.id);
  const [sourceType, setSourceType] =
    useState<(typeof SOURCE_TYPES)[number]["value"]>("personal_note");
  const [citation, setCitation] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [overlaps, setOverlaps] = useState<Array<OverlapCandidate & { similarity: number }>>([]);
  const [isChecking, startCheck] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const contentRef = useRef<HTMLTextAreaElement | null>(null);

  // Group the 64 leaf categories by their top-level shelf so the select is
  // scannable instead of one endless flat list.
  const groupedCategories = useMemo(() => {
    const parentByKey = new Map(CATEGORY_TAXONOMY.map((c) => [c.key, c.parentKey]));
    const labelByKey = new Map(CATEGORY_TAXONOMY.map((c) => [c.key, c.labelKo]));
    const topLabel = (key: string): string => {
      let current = key;
      while (parentByKey.get(current)) current = parentByKey.get(current)!;
      return labelByKey.get(current) ?? current;
    };
    const groups = new Map<string, CategoryDef[]>();
    for (const leaf of leafCategories) {
      const group = topLabel(leaf.key);
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group)!.push(leaf);
    }
    return Array.from(groups.entries());
  }, [leafCategories]);

  /** 제목을 비워두면 내용 첫 줄이 제목이 된다. */
  const effectiveTitle = useMemo(() => {
    if (title.trim()) return title.trim();
    const firstLine =
      content
        .split("\n")
        .map((l) => l.replace(/^[#>\-*\s]+/, "").trim())
        .find(Boolean) ?? "";
    return firstLine.slice(0, 80);
  }, [title, content]);

  function checkOverlap(nextTitle: string, nextCategoryKey: string) {
    if (nextTitle.trim().length < 2) return;
    startCheck(async () => {
      const result = await previewOverlapsAction(nextTitle, nextCategoryKey);
      setOverlaps(result);
    });
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
          title: effectiveTitle,
          content,
          categoryKey,
          tier,
          tags: tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          sources: [
            {
              type: sourceType,
              citation: citation.trim() || "진료 중 직접 메모",
              url: sourceUrl.trim() || undefined,
            },
          ],
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
      {/* Content comes first — the note IS the content. */}
      <div>
        <label className="mb-1 block text-sm font-medium">
          방금 배운 것, 그대로 적으세요
        </label>
        <div className="mb-2">
          <EditorToolbar
            target={{ textareaRef: contentRef, value: content, onChange: setContent }}
          />
        </div>
        <textarea
          ref={contentRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onBlur={() => checkOverlap(effectiveTitle, categoryKey)}
          rows={12}
          autoFocus
          className="field leading-relaxed"
          placeholder={
            "예: 울쎄라 이마는 1.5mm 팁으로 라인당 에너지 낮춰서. 눈썹 직상방은 통증 심해서 미리 고지.\n\n" +
            "한글+영어 섞어 쓰고, 수치는 그대로. 표/기호가 필요하면 위 툴바를 쓰세요.\n" +
            "긴 원문(논문/PDF)은 여기 말고 대시보드에 던져 넣으면 AI가 정리합니다."
          }
        />
        {fieldErrors.content && <p className="mt-1 text-xs text-red-600">{fieldErrors.content}</p>}
      </div>

      {/* Title optional — first line becomes the title. */}
      <div>
        <label className="mb-1 block text-sm font-medium">
          제목 <span className="font-normal text-ink/40">(비우면 첫 줄이 제목이 됩니다)</span>
        </label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => checkOverlap(effectiveTitle, categoryKey)}
          className="field"
          placeholder={effectiveTitle || "예: 울쎄라 이마 시술 팁"}
        />
        {fieldErrors.title && <p className="mt-1 text-xs text-red-600">{fieldErrors.title}</p>}
      </div>

      {overlaps.length > 0 && (
        <div className="animate-pop-in rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm">
          <p className="mb-1 font-medium text-amber-800">
            {isChecking ? "확인 중..." : "비슷한 기존 노트가 있습니다 — 저장하면 자동으로 연결됩니다."}
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
          <label className="mb-1 block text-sm font-medium">카테고리</label>
          <select
            value={categoryKey}
            onChange={(e) => {
              setCategoryKey(e.target.value);
              checkOverlap(effectiveTitle, e.target.value);
            }}
            className="field"
          >
            {groupedCategories.map(([group, leaves]) => (
              <optgroup key={group} label={group}>
                {leaves.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.labelKo}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {fieldErrors.categoryKey && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.categoryKey}</p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">이 지식의 성격</label>
          <div className="flex flex-wrap gap-1.5">
            {CONTENT_TIERS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTier(t.id)}
                title={t.descriptionKo}
                className={`rounded-full border px-3 py-1.5 text-xs transition-all ${
                  tier === t.id
                    ? "border-ink bg-ink text-white"
                    : "border-ink/15 bg-white text-ink/60 hover:border-ink/40"
                }`}
              >
                {t.labelKo}
              </button>
            ))}
          </div>
          {fieldErrors.tier && <p className="mt-1 text-xs text-red-600">{fieldErrors.tier}</p>}
        </div>
      </div>

      {/* Source: one line by default, details only if wanted. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">
            출처 <span className="font-normal text-ink/40">(비우면 &quot;진료 중 직접 메모&quot;)</span>
          </label>
          <div className="flex gap-2">
            <select
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value as typeof sourceType)}
              className="field !w-36 shrink-0"
            >
              {SOURCE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <input
              value={citation}
              onChange={(e) => setCitation(e.target.value)}
              className="field"
              placeholder="예: OO 세미나 2026 / Merz 가이드 v3"
            />
          </div>
          {fieldErrors.sources && <p className="mt-1 text-xs text-red-600">{fieldErrors.sources}</p>}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">
            태그 <span className="font-normal text-ink/40">(선택, 쉼표 구분)</span>
          </label>
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="field"
            placeholder="예: ulthera, forehead, pain-control"
          />
        </div>
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-ink/50 hover:text-ink">출처 URL 추가</summary>
        <input
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
          className="field mt-2"
          placeholder="https://..."
        />
      </details>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button type="submit" disabled={isSubmitting || !content.trim()} className="btn-primary">
        {isSubmitting ? "저장 중..." : "저장"}
      </button>
    </form>
  );
}
