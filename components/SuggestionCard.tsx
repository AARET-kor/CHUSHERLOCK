"use client";

import { useState } from "react";
import Link from "next/link";
import type { CategoryDef } from "../lib/codex/types";
import { CONTENT_TIERS } from "../lib/codex/tiers";
import type { SuggestedEntry } from "../lib/ai/schemas";

interface SourceMeta {
  citation: string;
  type: string;
  url?: string | null;
}

type SaveState = "idle" | "saving" | "saved" | "error";

export function SuggestionCard({
  suggestion,
  leafCategories,
  source,
}: {
  suggestion: SuggestedEntry;
  leafCategories: CategoryDef[];
  source: SourceMeta;
}) {
  const [draft, setDraft] = useState(suggestion);
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [savedEntryId, setSavedEntryId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  async function save() {
    setState("saving");
    setError(null);
    try {
      const response = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title,
          content: draft.content,
          categoryKey: draft.categoryKey,
          tier: draft.tier,
          tags: draft.tags,
          sources: [
            {
              type: source.type,
              citation: `${source.citation} — ${draft.sourceLocation}`,
              url: source.url || undefined,
            },
          ],
          relatedEntryIds: [],
          status: "draft",
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "저장에 실패했습니다.");
        setState("error");
        return;
      }
      setSavedEntryId(data.entry.id);
      setState("saved");
    } catch {
      setError("저장 요청에 실패했습니다.");
      setState("error");
    }
  }

  if (state === "saved") {
    return (
      <div className="animate-pop-in rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
        <p className="text-sm text-emerald-800">
          저장됨: <span className="font-medium">{draft.title}</span>
          {savedEntryId && (
            <Link href={`/entries/${savedEntryId}`} className="ml-2 underline">
              보기
            </Link>
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 card p-5">
      <div className="flex items-start justify-between gap-2">
        <input
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          className="w-full field !px-2 !py-1 font-medium"
        />
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="shrink-0 rounded border border-ink/10 px-2 py-1 text-xs text-ink/50 hover:border-ink/30"
          title="이 제안 버리기"
        >
          버리기
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <select
          value={draft.categoryKey}
          onChange={(e) => setDraft({ ...draft, categoryKey: e.target.value })}
          className="field !px-2 !py-1"
        >
          {leafCategories.map((c) => (
            <option key={c.key} value={c.key}>
              {c.labelKo} / {c.labelEn}
            </option>
          ))}
        </select>
        <select
          value={draft.tier}
          onChange={(e) => setDraft({ ...draft, tier: e.target.value as SuggestedEntry["tier"] })}
          className="field !px-2 !py-1"
        >
          {CONTENT_TIERS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.labelKo} / {t.labelEn}
            </option>
          ))}
        </select>
      </div>

      <textarea
        value={draft.content}
        onChange={(e) => setDraft({ ...draft, content: e.target.value })}
        rows={Math.min(18, Math.max(6, draft.content.split("\n").length + 1))}
        className="w-full field font-mono !px-2 !py-1 text-xs leading-relaxed"
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-ink/50">
          위치: {draft.sourceLocation} · 태그: {draft.tags.join(", ") || "없음"}
        </p>
        <button
          type="button"
          onClick={save}
          disabled={state === "saving"}
          className="btn-primary !px-4 !py-2"
        >
          {state === "saving" ? "저장 중..." : "이대로 저장"}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
