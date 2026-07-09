"use client";

import { useMemo, useState } from "react";
import type { CodexEntry, ContentTier, CategoryDef } from "../lib/codex/types";
import { CONTENT_TIERS } from "../lib/codex/tiers";
import { EntryCard } from "./EntryCard";
import { Reveal } from "./Reveal";

export function EntryExplorer({
  entries,
  categories,
}: {
  entries: CodexEntry[];
  categories: CategoryDef[];
}) {
  const [query, setQuery] = useState("");
  const [tier, setTier] = useState<ContentTier | "all">("all");
  const [categoryKey, setCategoryKey] = useState<string>("all");

  const usedCategories = useMemo(() => {
    const used = new Set(entries.map((e) => e.categoryKey));
    return categories.filter((c) => used.has(c.key));
  }, [entries, categories]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((entry) => {
      if (tier !== "all" && entry.tier !== tier) return false;
      if (categoryKey !== "all" && entry.categoryKey !== categoryKey) return false;
      if (!q) return true;
      return (
        entry.title.toLowerCase().includes(q) ||
        entry.content.toLowerCase().includes(q) ||
        entry.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    });
  }, [entries, query, tier, categoryKey]);

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="제목·내용·태그 검색..."
          className="field sm:max-w-xs"
        />
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setTier("all")}
            className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
              tier === "all" ? "bg-ink text-white" : "bg-mist text-ink/70 hover:bg-ink/10"
            }`}
          >
            전체
          </button>
          {CONTENT_TIERS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTier(tier === t.id ? "all" : t.id)}
              className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                tier === t.id ? "bg-ink text-white" : "bg-mist text-ink/70 hover:bg-ink/10"
              }`}
            >
              {t.labelKo}
            </button>
          ))}
        </div>
        <select
          value={categoryKey}
          onChange={(e) => setCategoryKey(e.target.value)}
          className="field sm:ml-auto sm:w-56"
        >
          <option value="all">모든 카테고리</option>
          {usedCategories.map((c) => (
            <option key={c.key} value={c.key}>
              {c.labelKo} / {c.labelEn}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-ink/15 bg-mist/50 p-10 text-center text-sm text-ink/50">
          조건에 맞는 노트가 없습니다.
        </p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          {filtered.map((entry, index) => (
            <Reveal key={entry.id} delay={Math.min(index, 6) * 0.06}>
              <EntryCard entry={entry} />
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}
