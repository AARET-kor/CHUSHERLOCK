"use client";

import { useId, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { displayEn, type AtlasStructure } from "../../../lib/bbip/anatomy/atlas";
import { searchStructures } from "../../../lib/bbip/anatomy/explorer";
import { DEPTHS, type DepthKey } from "../../../lib/bbip/anatomy/layers";
import { layerColor } from "./vocab";
import { Term } from "../Term";

export type ExplorerMode = "clinical" | "explain" | "explore";
const MODES: { key: ExplorerMode; label: string; en: string; description: string }[] = [
  { key: "clinical", label: "진료 확인", en: "Clinical", description: "혈관·신경과 위험구역을 중심으로 확인합니다." },
  { key: "explain", label: "시각적 설명", en: "Explain", description: "현재 부위를 확대합니다. 구조물을 눌러 하나씩 설명해 보세요." },
  { key: "explore", label: "자세히 탐색", en: "Explore", description: "근육·지방·인대까지 펼쳐 보고, 층을 선택해 관계를 살펴봅니다." },
];

export function ExplorerControls({
  mode, onMode, depth, onDepth, structures, onPick,
}: {
  mode: ExplorerMode;
  onMode: (mode: ExplorerMode) => void;
  depth: DepthKey | null;
  onDepth: (depth: DepthKey | null) => void;
  structures: AtlasStructure[];
  onPick: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const searchId = useId();
  const results = useMemo(() => query.trim() ? searchStructures(structures, query) : [], [structures, query]);
  return (
    <div className="mb-5 rounded-2xl border border-ink/10 bg-[#faf9f6] p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div role="group" aria-label="해부 지도 사용 모드" className="flex flex-wrap gap-1 rounded-xl bg-ink/5 p-1">
            {MODES.map((item) => (
              <button key={item.key} type="button" aria-pressed={mode === item.key} onClick={() => onMode(item.key)}
                className={`rounded-lg px-3 py-2 text-[14px] transition ${mode === item.key ? "bg-inkdeep font-semibold text-white shadow-sm" : "text-ink/75 hover:bg-white"}`}>
                <Term term={{ en: item.en, ko: item.label }} />
              </button>
            ))}
          </div>
          <p className="mt-2 max-w-md text-[13px] leading-relaxed text-ink/70">{MODES.find((item) => item.key === mode)?.description}</p>
        </div>
        <div className="relative w-full sm:w-64">
          <label htmlFor={searchId} className="sr-only">해부 구조물 검색</label>
          <div className="flex items-center gap-2 rounded-xl border border-ink/15 bg-white px-3 focus-within:ring-2 focus-within:ring-ink/40">
            <Search size={16} aria-hidden="true" className="shrink-0 text-ink/55" />
            <input id={searchId} type="search" value={query} onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") setQuery(""); }}
              placeholder="Search structures · 구조물 검색 (각동맥, masseter)"
              className="min-w-0 flex-1 bg-transparent py-2.5 text-[13px] text-ink outline-none" />
          </div>
          {query.trim() && (
            <div role="region" aria-label="구조물 검색 결과" className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-xl border border-ink/15 bg-white p-2 shadow-lg">
              <p role="status" className="px-2 py-1 text-[12px] text-ink/65">{results.length}개 구조물</p>
              {results.map((s) => (
                <button type="button" key={s.id} onClick={() => { onPick(s.id); setQuery(""); }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-ink/5">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: layerColor(s.layer) }} />
                  <span className="min-w-0"><span className="block text-[14px] font-semibold">{displayEn(s.en)}</span><span lang="ko" className="block text-[12px] text-ink/65">{s.ko}</span></span>
                </button>
              ))}
              {!results.length && <p className="px-2 py-2 text-[13px] text-ink/70">한글·영문 이름이나 별칭으로 검색해 보세요.</p>}
            </div>
          )}
        </div>
      </div>
      <div role="group" aria-label="깊이 탐색" className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-ink/10 pt-3">
        <span className="mr-2 text-[12px] font-semibold text-ink/65"><Term term={{ en: "Superficial → Deep", ko: "표층 → 심층" }} /></span>
        {[{ key: null, ko: "모든 층", en: "All Layers" }, ...DEPTHS].map((d, i) => (
          <button key={d.key ?? "all"} type="button" aria-pressed={depth === d.key} onClick={() => onDepth(d.key)}
            className={`rounded-full border px-2.5 py-1.5 text-[12px] transition ${depth === d.key ? "border-inkdeep bg-inkdeep text-white" : "border-ink/15 bg-white text-ink/75 hover:border-ink/40"}`}>
            {i > 0 && <span className="mr-1 opacity-60">{i}</span>}<Term term={d} />
          </button>
        ))}
        {depth && <button type="button" aria-label="깊이 필터 해제" onClick={() => onDepth(null)} className="rounded-full p-2 text-ink/70"><X size={14} /></button>}
      </div>
      {depth && <p className="mt-2 text-[12px] text-ink/70">선택한 층을 지나는 구조물만 표시합니다. 같은 층에 있다는 것이 실제 접촉이나 인접을 뜻하지는 않습니다.</p>}
    </div>
  );
}
