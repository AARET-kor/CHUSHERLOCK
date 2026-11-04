// app/papers/page.tsx
import Link from "next/link";
import { FilterChips } from "../../components/papers/FilterChips";
import { PaperRow } from "../../components/papers/PaperRow";
import { SyncBar } from "../../components/papers/SyncBar";
import { LEVEL_LABEL } from "../../lib/bbip/literature/refs";
import type { LitLevel } from "../../lib/bbip/types";
import { REVIEW_LABEL, SUBJECT_LABEL } from "../../lib/papers/labels";
import { TOPICS } from "../../lib/papers/topics";
import { TOPIC_KEYS, type PaperFilters, type ReviewStatus, type SubjectKind, type TopicKey } from "../../lib/papers/types";
import { latestRun, listPapers, PAGE_SIZE, recentlyAnalyzed } from "../../lib/services/paperService";

export const dynamic = "force-dynamic";

type Params = Record<string, string | undefined>;

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const oneOf = <T extends string>(value: string | undefined, allowed: readonly T[]): T | undefined =>
  allowed.includes(value as T) ? (value as T) : undefined;

export default async function PapersPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const filters: PaperFilters = {
    topic: oneOf<TopicKey>(params.topic, TOPIC_KEYS),
    level: oneOf<LitLevel>(params.level, Object.keys(LEVEL_LABEL) as LitLevel[]),
    subject: oneOf<SubjectKind>(params.subject, Object.keys(SUBJECT_LABEL) as SubjectKind[]),
    analysis: oneOf(params.analysis, ["analyzed", "unanalyzed"] as const),
    review: oneOf<ReviewStatus>(params.review, Object.keys(REVIEW_LABEL) as ReviewStatus[]),
    sort: oneOf(params.sort, ["if", "recent"] as const) ?? "if",
    page: Math.max(1, Number(params.page) || 1),
  };
  const { rows, total } = listPapers(filters);
  // Only on the unfiltered first page: a filtered list must show just its matches.
  const moreFilters = Boolean(filters.level || filters.subject || filters.analysis || filters.review);
  const filtered = Boolean(filters.topic || moreFilters);
  const recent = filtered || filters.page! > 1 ? [] : recentlyAnalyzed(new Date(Date.now() - WEEK_MS).toISOString());
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const hrefWith = (key: string, value: string | undefined) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v && k !== key && k !== "page") next.set(k, v);
    if (value) next.set(key, value);
    const query = next.toString();
    return query ? `/papers?${query}` : "/papers";
  };
  const pageHref = (page: number) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v && k !== "page") next.set(k, v);
    next.set("page", String(page));
    return `/papers?${next}`;
  };

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-ink/15 pb-6">
        <div>
          <p className="mb-2 font-mono text-xs tracking-widest text-ink/60">PAPERS / 논문</p>
          <h1 className="font-serifa text-3xl font-bold text-inkdeep">미용 논문, 한계까지 읽어서.</h1>
          <p className="mt-2 max-w-[640px] text-sm text-ink/65">
            AI 분석입니다. 인용 전 원문을 확인하세요. IF는 근사값이며 <Link href="/papers/journals" className="underline underline-offset-4">저널 표</Link>에서 고칠 수 있습니다.
          </p>
        </div>
        <SyncBar initial={latestRun()} />
      </header>

      {recent.length > 0 && (
        <section aria-labelledby="papers-recent" className="mb-8">
          <h2 id="papers-recent" className="mb-1 text-[14.5px] font-semibold text-ink/70">This week · 이번 주 분석</h2>
          <ul>{recent.map((paper) => <PaperRow key={paper.pmid} paper={paper} />)}</ul>
        </section>
      )}

      <div className="mb-4 space-y-2">
        <FilterChips
          label="Topic · 주제"
          value={filters.topic}
          hrefFor={(v) => hrefWith("topic", v)}
          options={[{ value: undefined, text: "All · 전체" }, ...TOPIC_KEYS.map((key) => ({ value: key, text: `${TOPICS[key].en} · ${TOPICS[key].ko}` }))]}
        />
        <FilterChips
          label="Sort · 정렬"
          value={filters.sort}
          hrefFor={(v) => hrefWith("sort", v)}
          options={[{ value: "if", text: "IF · IF 높은 순" }, { value: "recent", text: "Recent · 최신순" }]}
        />
        <details open={moreFilters} className="text-[13.5px]">
          <summary className="cursor-pointer py-1 text-ink/70">More filters · 필터 더 보기</summary>
          <div className="mt-1 space-y-2">
        <FilterChips
          label="Type · 유형"
          value={filters.level}
          hrefFor={(v) => hrefWith("level", v)}
          options={[{ value: undefined, text: "All · 전체" }, ...(Object.keys(LEVEL_LABEL) as LitLevel[]).map((key) => ({ value: key, text: LEVEL_LABEL[key] }))]}
        />
        <FilterChips
          label="Subject · 대상"
          value={filters.subject}
          hrefFor={(v) => hrefWith("subject", v)}
          options={[{ value: undefined, text: "All · 전체" }, ...(Object.keys(SUBJECT_LABEL) as SubjectKind[]).map((key) => ({ value: key, text: `${SUBJECT_LABEL[key].en} · ${SUBJECT_LABEL[key].ko}` }))]}
        />
        <FilterChips
          label="Analysis · 분석"
          value={filters.analysis}
          hrefFor={(v) => hrefWith("analysis", v)}
          options={[{ value: undefined, text: "All · 전체" }, { value: "analyzed", text: "Analyzed · 분석됨" }, { value: "unanalyzed", text: "Not analyzed · 미분석" }]}
        />
        <FilterChips
          label="Review · 검토"
          value={filters.review}
          hrefFor={(v) => hrefWith("review", v)}
          options={[{ value: undefined, text: "All · 전체" }, ...(Object.keys(REVIEW_LABEL) as ReviewStatus[]).map((key) => ({ value: key, text: `${REVIEW_LABEL[key].en} · ${REVIEW_LABEL[key].ko}` }))]}
        />
          </div>
        </details>
      </div>

      <p className="text-[14px] text-ink/65">{total.toLocaleString()} papers · 논문 {total.toLocaleString()}편</p>
      {rows.length === 0 ? (
        <p className="py-10 text-[15px] text-ink/60">조건에 맞는 논문이 없습니다. 아직 수집 전이면 지금 수집을 눌러 보세요.</p>
      ) : (
        <ul>{rows.map((paper) => <PaperRow key={paper.pmid} paper={paper} />)}</ul>
      )}

      {pages > 1 && (
        <nav aria-label="페이지" className="mt-6 flex items-center gap-4 text-[14.5px]">
          {filters.page! > 1 && <Link href={pageHref(filters.page! - 1)} className="underline underline-offset-4">← Prev · 이전</Link>}
          <span className="text-ink/65">{filters.page} / {pages}</span>
          {filters.page! < pages && <Link href={pageHref(filters.page! + 1)} className="underline underline-offset-4">Next · 다음 →</Link>}
        </nav>
      )}
    </div>
  );
}
