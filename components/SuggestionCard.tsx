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

export interface FigureMeta {
  id: string;
  filename: string;
  kind: string;
  caption: string;
  page: number | null;
}

type SaveState = "idle" | "saving" | "saved" | "error";

export function SuggestionCard({
  suggestion,
  leafCategories,
  source,
  figures = [],
}: {
  suggestion: SuggestedEntry;
  leafCategories: CategoryDef[];
  source: SourceMeta;
  figures?: FigureMeta[];
}) {
  const [draft, setDraft] = useState(suggestion);
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [savedEntryId, setSavedEntryId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const attachedFigures = figures.filter((f) => (draft.figureIds ?? []).includes(f.id));

  if (dismissed) return null;

  async function save() {
    setState("saving");
    setError(null);
    // Embed the cropped source figures at the end of the note so they render
    // in the note view and in Obsidian after export.
    let content = draft.content;
    const missing = attachedFigures.filter((f) => !content.includes(`/api/figures/${f.id}`));
    if (missing.length > 0) {
      content +=
        "\n\n---\n\n" +
        missing.map((f) => `![${f.caption}](/api/figures/${f.id})`).join("\n\n");
    }
    try {
      const response = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title,
          content,
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
          figureIds: attachedFigures.map((f) => f.id),
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

      {attachedFigures.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-ink/60">
            원본에서 잘라낸 시각 자료 {attachedFigures.length}개 — 저장 시 노트에 삽입됩니다
          </p>
          <div className="flex flex-wrap gap-2">
            {attachedFigures.map((f) => (
              <figure key={f.id} className="w-36">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/figures/${f.id}`}
                  alt={f.caption}
                  className="h-24 w-36 rounded-lg border border-ink/10 object-cover"
                />
                <figcaption className="mt-1 line-clamp-2 text-[10px] leading-tight text-ink/50">
                  {f.kind}{f.page ? ` · p.${f.page}` : ""} — {f.caption}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      )}

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
