"use client";

import { useEffect, useMemo, useState } from "react";
import type { CodexEntry, CategoryDef } from "../lib/codex/types";
import { CONTENT_TIERS } from "../lib/codex/tiers";
import { readKnowledgePrefs, writeKnowledgePrefs, type KnowledgePrefs } from "../lib/knowledge/preferences";
import { EntryCard } from "./EntryCard";

export function EntryExplorer({ entries, categories }: { entries: CodexEntry[]; categories: CategoryDef[] }) {
  const [query, setQuery] = useState("");
  const [tier, setTier] = useState("all");
  const [category, setCategory] = useState("all");
  const [view, setView] = useState("all");
  const [sort, setSort] = useState("updated");
  const [limit, setLimit] = useState(24);
  const [prefs, setPrefs] = useState<KnowledgePrefs>({ pinned: [], recent: [] });
  const [storageError, setStorageError] = useState(false);
  useEffect(() => {
    setQuery(new URLSearchParams(window.location.search).get("q") ?? "");
    const refresh = () => setPrefs(readKnowledgePrefs());
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("knowledge-prefs", refresh);
    return () => { window.removeEventListener("storage", refresh); window.removeEventListener("knowledge-prefs", refresh); };
  }, []);
  useEffect(() => setLimit(24), [query, tier, category, view, sort]);
  const filtered = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return entries.filter(e => {
      if (tier !== "all" && e.tier !== tier) return false;
      if (category !== "all" && e.categoryKey !== category) return false;
      if (view === "pinned" && !prefs.pinned.includes(e.id)) return false;
      if (view === "recent" && !prefs.recent.includes(e.id)) return false;
      if (view === "draft" && e.status !== "draft") return false;
      if (view === "reviewed" && e.status !== "reviewed") return false;
      const haystack = [e.title, e.content, ...e.tags, ...e.sources.map(s => s.citation)].join(" ").toLowerCase();
      return terms.every(t => haystack.includes(t));
    }).sort((a, b) => view === "recent" ? prefs.recent.indexOf(a.id) - prefs.recent.indexOf(b.id)
      : sort === "title" ? a.title.localeCompare(b.title, "ko") : b.updatedAt.localeCompare(a.updatedAt));
  }, [entries, query, tier, category, view, sort, prefs]);
  function pin(id: string) {
    const current = readKnowledgePrefs();
    const next = { ...current, pinned: current.pinned.includes(id) ? current.pinned.filter(v => v !== id) : [id, ...current.pinned] };
    setStorageError(!writeKnowledgePrefs(next));
    setPrefs(next);
  }
  return <div>
    <label htmlFor="knowledge-search" className="mb-2 block text-sm font-medium">필요한 지식 찾기</label>
    <input id="knowledge-search" value={query} onChange={e => setQuery(e.target.value)} placeholder="제목 · 내용 · 태그 · 출처 검색" className="field mb-4 w-full !py-4 !text-lg" type="search" />
    <div role="group" aria-label="노트 보기" className="mb-4 flex flex-wrap gap-2">
      {[["all", "전체"], ["pinned", "고정"], ["recent", "최근 열람"], ["draft", "검토 대기"], ["reviewed", "검토 완료"]].map(([key, label]) =>
        <button key={key} type="button" aria-pressed={view === key} onClick={() => setView(key!)} className={`rounded-full border px-3 py-2 text-sm ${view === key ? "bg-ink text-white" : "border-ink/20"}`}>{label}</button>)}
    </div>
    <details className="mb-4"><summary className="cursor-pointer text-sm text-ink/70">상세 필터 · 정렬{tier !== "all" || category !== "all" ? " (필터 적용 중)" : ""}</summary>
    <div className="mt-3 flex flex-wrap gap-3">
      <select aria-label="자료 종류" className="field w-full sm:!w-auto" value={tier} onChange={e => setTier(e.target.value)}>
        <option value="all">모든 종류</option>{CONTENT_TIERS.map(t => <option key={t.id} value={t.id}>{t.labelKo}</option>)}
      </select>
      <select aria-label="노트 카테고리 필터" className="field w-full sm:!w-auto" value={category} onChange={e => setCategory(e.target.value)}>
        <option value="all">모든 카테고리</option>{categories.filter(c => entries.some(e => e.categoryKey === c.key)).map(c => <option key={c.key} value={c.key}>{c.labelKo}</option>)}
      </select>
      <select aria-label="노트 정렬" className="field w-full sm:!w-auto" value={sort} onChange={e => setSort(e.target.value)} disabled={view === "recent"}>
        <option value="updated">최근 수정순</option><option value="title">제목순</option>
      </select>
      <button type="button" className="text-sm underline" onClick={() => { setQuery(""); setTier("all"); setCategory("all"); setView("all"); setSort("updated"); }}>필터 초기화</button>
    </div>
    </details>
    <p className="mb-5 text-xs text-ink/65" role="status">검색 결과 {filtered.length}개 · 고정과 최근 열람은 이 브라우저에 저장됩니다.</p>
    {storageError && <p role="alert">브라우저 저장이 차단되어 고정 상태를 저장하지 못했습니다.</p>}
    {filtered.length ? <div className="grid gap-5 sm:grid-cols-2">{filtered.slice(0, limit).map(e => <div key={e.id}>
      <button type="button" aria-label={`${e.title} 고정`} aria-pressed={prefs.pinned.includes(e.id)} onClick={() => pin(e.id)} className="mb-1 px-2 py-1 text-sm text-ink/70">{prefs.pinned.includes(e.id) ? "★ 고정됨" : "☆ 고정"}</button>
      <EntryCard entry={e} />
    </div>)}</div> : <p className="rounded-xl border border-dashed p-8 text-center">조건에 맞는 노트가 없습니다. 검색어나 필터를 바꿔 보세요.</p>}
    {filtered.length > limit && <button type="button" className="btn-secondary mt-6" onClick={() => setLimit(n => n + 24)}>24개 더 보기</button>}
  </div>;
}
