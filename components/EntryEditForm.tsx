"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CategoryDef, CodexEntry, ContentTier } from "../lib/codex/types";
import { CONTENT_TIERS } from "../lib/codex/tiers";

export function EntryEditForm({
  entry,
  leafCategories,
}: {
  entry: CodexEntry;
  leafCategories: CategoryDef[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState(entry.title);
  const [content, setContent] = useState(entry.content);
  const [categoryKey, setCategoryKey] = useState(entry.categoryKey);
  const [tier, setTier] = useState<ContentTier>(entry.tier);
  const [tags, setTags] = useState(entry.tags.join(", "));
  const [status, setStatus] = useState(entry.status);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSaving(true);
    try {
      const response = await fetch(`/api/entries/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          content,
          categoryKey,
          tier,
          status,
          tags: tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "저장에 실패했습니다.");
        return;
      }
      router.push(`/entries/${entry.id}`);
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="mb-1 block text-sm font-medium">제목</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="field" />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium">카테고리</label>
          <select
            value={categoryKey}
            onChange={(e) => setCategoryKey(e.target.value)}
            className="field"
          >
            {leafCategories.map((c) => (
              <option key={c.key} value={c.key}>
                {c.labelKo} / {c.labelEn}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">난이도/성격</label>
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value as ContentTier)}
            className="field"
          >
            {CONTENT_TIERS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.labelKo} / {t.labelEn}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">상태</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
            className="field"
          >
            <option value="draft">초안</option>
            <option value="reviewed">검토 완료</option>
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">내용 (Markdown)</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={Math.min(28, Math.max(10, content.split("\n").length + 2))}
          className="field font-mono text-xs leading-relaxed"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">태그 (쉼표로 구분)</label>
        <input value={tags} onChange={(e) => setTags(e.target.value)} className="field" />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={isSaving} className="btn-primary">
          {isSaving ? "저장 중..." : "수정 저장"}
        </button>
        <button
          type="button"
          onClick={() => router.push(`/entries/${entry.id}`)}
          className="btn-secondary"
        >
          취소
        </button>
      </div>
    </form>
  );
}
