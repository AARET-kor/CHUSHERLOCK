// components/records/RecordsHome.tsx
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { procedureKey } from "../../lib/bbip/care/sets";
import { classifyProcedure, MAJORS, majorOf, type MajorKey } from "../../lib/records/taxonomy";
import type { PatientSummary } from "../../lib/records/types";
import { CategoryTag, FeatureTags } from "./CategoryTag";

type Filter = "all" | "active" | "fu" | "done";
type Sort = "recent" | "category" | "chart";

const FILTERS: Array<{ key: Filter; en: string; ko: string }> = [
  { key: "all", en: "All", ko: "전체" },
  { key: "active", en: "Active", ko: "진행 중" },
  { key: "fu", en: "F/U due", ko: "F/U 예정" },
  { key: "done", en: "Done", ko: "완료" },
];

const SORTS: Array<{ key: Sort; en: string; ko: string }> = [
  { key: "recent", en: "Recent", ko: "최근 방문" },
  { key: "category", en: "Category", ko: "카테고리별" },
  { key: "chart", en: "Chart No", ko: "차트번호" },
];

const MAJOR_ORDER = new Map(MAJORS.map((m, i) => [m.key, i]));

interface Row {
  summary: PatientSummary;
  /** Classification per course, in summary.courses order. */
  tags: Array<ReturnType<typeof classifyProcedure>>;
  /** The patient's main category: first (active, most recent) course. */
  primary: MajorKey;
}

function chipStyle(key: MajorKey, on: boolean) {
  const m = majorOf(key);
  return on
    ? { background: m.color.dot, borderColor: m.color.dot, color: "#ffffff" }
    : { background: m.color.bg, borderColor: m.color.border, color: m.color.text };
}

/** Patient list: instant search, status filter, colored category tags with
 * major › mid filters, and sorting by recency, category or chart number. */
export function RecordsHome({ summaries, weekEnd }: { summaries: PatientSummary[]; weekEnd: string }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [major, setMajor] = useState<MajorKey | null>(null);
  const [mid, setMid] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("recent");

  const rows: Row[] = useMemo(
    () =>
      summaries.map((summary) => {
        const tags = summary.courses.map((c) => classifyProcedure(c.procedure));
        return { summary, tags, primary: tags[0]?.major ?? "other" };
      }),
    [summaries]
  );

  // Counts for the category bar: patients with at least one course in each.
  const majorCounts = useMemo(() => {
    const counts = new Map<MajorKey, number>();
    for (const r of rows) for (const key of new Set(r.tags.map((t) => t.major))) counts.set(key, (counts.get(key) ?? 0) + 1);
    return counts;
  }, [rows]);
  const midCounts = useMemo(() => {
    const counts = new Map<string, number>();
    if (!major) return counts;
    for (const r of rows) {
      const mids = new Set(r.tags.filter((t) => t.major === major && t.mid).map((t) => t.mid!));
      for (const m of mids) counts.set(m, (counts.get(m) ?? 0) + 1);
    }
    return counts;
  }, [rows, major]);

  const shown = useMemo(() => {
    const q = procedureKey(query);
    const list = rows.filter(({ summary: s, tags }) => {
      if (filter === "active" && s.activeCourses.length === 0) return false;
      if (filter === "done" && s.activeCourses.length > 0) return false;
      if (filter === "fu" && !(s.nextFu && s.nextFu <= weekEnd)) return false;
      if (major && !tags.some((t) => t.major === major && (!mid || t.mid === mid))) return false;
      if (!q) return true;
      return [s.patient.chartNo, s.patient.alias, s.patient.features, ...s.procedures].some((t) => procedureKey(t).includes(q));
    });
    if (sort === "chart") return [...list].sort((a, b) => a.summary.patient.chartNo.localeCompare(b.summary.patient.chartNo, "ko", { numeric: true }));
    if (sort === "category") {
      // Stable sort keeps recency inside each category.
      return [...list].sort((a, b) => (MAJOR_ORDER.get(a.primary) ?? 99) - (MAJOR_ORDER.get(b.primary) ?? 99));
    }
    return list;
  }, [rows, query, filter, major, mid, sort, weekEnd]);

  function pickMajor(key: MajorKey | null) {
    setMajor((current) => (current === key ? null : key));
    setMid(null);
  }

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
        <label className="text-[13px] text-ink/70">
          Sort · 정렬
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="ml-2 border-b border-ink/20 bg-transparent py-1 text-[14.5px] text-ink">
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.en} · {s.ko}
              </option>
            ))}
          </select>
        </label>
      </div>

      {majorCounts.size > 0 && (
        <div className="mt-5 space-y-2">
          <div role="group" aria-label="시술 카테고리" className="flex flex-wrap gap-2">
            <button
              type="button"
              aria-pressed={major === null}
              onClick={() => pickMajor(null)}
              className={`rounded-full border px-3 py-1 text-[13.5px] ${major === null ? "border-inkdeep bg-inkdeep text-white" : "border-ink/15 text-ink hover:bg-mist"}`}
            >
              All · 전체 <span className="font-mono">{rows.length}</span>
            </button>
            {MAJORS.filter((m) => majorCounts.has(m.key)).map((m) => (
              <button
                key={m.key}
                type="button"
                aria-pressed={major === m.key}
                onClick={() => pickMajor(m.key)}
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[13.5px]"
                style={chipStyle(m.key, major === m.key)}
              >
                <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: major === m.key ? "#ffffff" : m.color.dot }} />
                <span className="font-semibold">{m.en}</span> {m.ko}
                <span className="font-mono">{majorCounts.get(m.key)}</span>
              </button>
            ))}
          </div>
          {major && midCounts.size > 0 && (
            <div role="group" aria-label={`${majorOf(major).ko} 세부 분류`} className="flex flex-wrap gap-2 pl-1">
              <span className="self-center text-[12.5px] text-ink/60">›</span>
              {[...midCounts.entries()].map(([label, count]) => (
                <button
                  key={label}
                  type="button"
                  aria-pressed={mid === label}
                  onClick={() => setMid((current) => (current === label ? null : label))}
                  className="rounded-full border px-2.5 py-0.5 text-[13px]"
                  style={chipStyle(major, mid === label)}
                >
                  {label} <span className="font-mono">{count}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {shown.length === 0 ? (
        <p className="py-10 text-[15px] text-ink/60">
          {summaries.length === 0 ? "아직 기록된 환자가 없습니다. 진료에서 #차트번호와 함께 케이스를 넣어 보세요." : "찾는 환자가 없습니다."}
        </p>
      ) : (
        <ul className="mt-4">
          {shown.map(({ summary: s, tags, primary }, i) => {
            const groupStart = sort === "category" && (i === 0 || shown[i - 1]!.primary !== primary);
            const m = majorOf(primary);
            return (
              <li key={s.patient.id} className="border-b border-ink/[0.07]">
                {groupStart && (
                  <p className="mt-4 flex items-center gap-2 border-b pb-1.5 text-[13.5px] font-semibold" style={{ color: m.color.text, borderColor: m.color.border }}>
                    <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: m.color.dot }} />
                    {m.en} · {m.ko}
                  </p>
                )}
                <Link href={`/patients/${s.patient.id}`} className="group grid gap-x-6 gap-y-1 py-3 sm:grid-cols-[150px_minmax(0,1fr)_auto]">
                  <span className="font-mono text-[14px] tabular-nums text-inkdeep">#{s.patient.chartNo}</span>
                  <span className="min-w-0">
                    <span className="block truncate font-serifa text-[18.5px] text-inkdeep group-hover:underline">
                      {s.patient.alias || s.patient.features || "별칭 없음"}
                    </span>
                    <span className="mt-1.5 flex flex-wrap gap-1.5">
                      {s.courses.map((c, j) => (
                        <CategoryTag
                          key={c.id}
                          procedure={c.procedure}
                          classification={tags[j]}
                          extra={c.status !== "active" ? undefined : c.planned ? `${c.done}/${c.planned}` : c.done ? `${c.done}회` : undefined}
                          done={c.status !== "active"}
                          size="sm"
                        />
                      ))}
                      <FeatureTags features={s.patient.alias ? s.patient.features : ""} size="sm" />
                    </span>
                  </span>
                  <span className="text-right font-mono text-[12.5px] text-ink/60">
                    {s.lastVisit ? `Last ${s.lastVisit.slice(5)}` : "방문 없음"}
                    {s.nextFu && <span className="block text-[#0f5132]">F/U {s.nextFu.slice(5)}</span>}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
