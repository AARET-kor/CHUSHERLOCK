// components/records/RecordsHome.tsx
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { procedureKey } from "../../lib/bbip/care/sets";
import type { PatientSummary } from "../../lib/records/types";

type Filter = "all" | "active" | "fu" | "done";

const FILTERS: Array<{ key: Filter; en: string; ko: string }> = [
  { key: "all", en: "All", ko: "전체" },
  { key: "active", en: "Active", ko: "진행 중" },
  { key: "fu", en: "F/U due", ko: "F/U 예정" },
  { key: "done", en: "Done", ko: "완료" },
];

/** Patient list with a search box that filters as you type (chart number,
 * alias, features, procedure). Data comes from the server page in one go. */
export function RecordsHome({ summaries, weekEnd }: { summaries: PatientSummary[]; weekEnd: string }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const shown = useMemo(() => {
    const q = procedureKey(query);
    return summaries.filter((s) => {
      if (filter === "active" && s.activeCourses.length === 0) return false;
      if (filter === "done" && s.activeCourses.length > 0) return false;
      if (filter === "fu" && !(s.nextFu && s.nextFu <= weekEnd)) return false;
      if (!q) return true;
      return [s.patient.chartNo, s.patient.alias, s.patient.features, ...s.procedures].some((t) => procedureKey(t).includes(q));
    });
  }, [summaries, query, filter, weekEnd]);

  return (
    <section aria-labelledby="records-patients" className="border-t border-ink/10 pt-6">
      <h2 id="records-patients" className="sr-only">
        환자 목록
      </h2>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <label className="min-w-[260px] flex-1">
          <span className="sr-only">환자 검색</span>
          <input
            type="search"
            value={query}
            autoFocus
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search · 차트번호, 별칭, 특징, 시술"
            className="bbip-line pb-2 font-serifa text-[22px] text-ink"
          />
        </label>
        <div role="group" aria-label="환자 필터" className="flex gap-1 rounded-full bg-mist p-1 text-[14px]">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-3 py-1 ${filter === f.key ? "bg-inkdeep text-white" : "text-ink hover:bg-white"}`}
            >
              {f.en} <span className="text-[0.8em]">{f.ko}</span>
            </button>
          ))}
        </div>
      </div>
      {shown.length === 0 ? (
        <p className="py-10 text-[15px] text-ink/60">
          {summaries.length === 0 ? "아직 기록된 환자가 없습니다. 진료에서 #차트번호와 함께 케이스를 넣어 보세요." : "찾는 환자가 없습니다."}
        </p>
      ) : (
        <ul className="mt-4">
          {shown.map((s) => (
            <li key={s.patient.id} className="border-b border-ink/[0.07]">
              <Link href={`/patients/${s.patient.id}`} className="group grid gap-x-6 gap-y-1 py-3 sm:grid-cols-[150px_minmax(0,1fr)_auto]">
                <span className="font-mono text-[14px] tabular-nums text-inkdeep">#{s.patient.chartNo}</span>
                <span className="min-w-0">
                  <span className="block truncate font-serifa text-[18.5px] text-inkdeep group-hover:underline">
                    {s.patient.alias || s.patient.features || "별칭 없음"}
                  </span>
                  <span className="block truncate text-[13.5px] text-ink/65">
                    {[s.patient.alias ? s.patient.features : "", ...s.activeCourses.map((c) => `${c.procedure} ${c.done}${c.planned ? `/${c.planned}` : "회"}`)]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <span className="text-right font-mono text-[12.5px] text-ink/60">
                  {s.lastVisit ? `Last ${s.lastVisit.slice(5)}` : "방문 없음"}
                  {s.nextFu && <span className="block text-[#0f5132]">F/U {s.nextFu.slice(5)}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
