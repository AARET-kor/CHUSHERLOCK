import { AnatomyNoteLinks } from "../../../components/AnatomyNoteLinks";
import { db } from "../../../lib/db/client";
import { figures } from "../../../lib/db/schema";
import { eq } from "drizzle-orm";
import { EntryVisitTracker } from "../../../components/EntryVisitTracker";
import { noteExcerpt } from "../../../lib/knowledge/preview";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getEntry, listEntries } from "../../../lib/services/entryService";
import { clusterNavForEntry } from "../../../lib/services/clusterService";
import { listCardsForEntry } from "../../../lib/services/flashcardService";
import { TierBadge } from "../../../components/TierBadge";
import { CategoryBadge } from "../../../components/CategoryBadge";
import { MarkdownContent } from "../../../components/MarkdownContent";
import { CardActions } from "../../../components/CardActions";
import { deleteEntryAction } from "../../../lib/actions/entryActions";
import { ClaimReviewControls } from "../../../components/ClaimReviewControls";

export default async function EntryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const entry = await getEntry(id);
  if (!entry) notFound();

  const allEntries = await listEntries();
  const related = entry.relatedEntryIds
    .map((relatedId) => allEntries.find((e) => e.id === relatedId))
    .filter((e): e is NonNullable<typeof e> => Boolean(e));

  const images = db.select().from(figures).where(eq(figures.entryId, id)).all();
  const nav = await clusterNavForEntry(id);
  const cards = await listCardsForEntry(id);
  const now = Date.now();
  const reviewOverdue = entry.reviewDueAt ? Date.parse(entry.reviewDueAt) < now : false;
  const expiredSources = entry.sources.filter(
    (source) => source.validUntil && Date.parse(source.validUntil) < now
  );
  const conflictingClaims = entry.claims.filter((claim) => claim.conflictStatus !== "none");

  return (
    <div>
      <EntryVisitTracker id={id} />
      {nav && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-ink/10 bg-mist/50 px-4 py-2.5 text-xs">
          <Link href="/study" className="min-w-0 truncate text-ink/70 hover:text-ink">
            <span className="text-ink/40">학습 묶음 · </span>
            <span className="font-medium">{nav.clusterTitle}</span>
            <span className="ml-1.5 tabular-nums text-ink/40">
              {nav.position + 1}/{nav.total}
            </span>
          </Link>
          <div className="flex shrink-0 gap-1.5">
            {nav.prev ? (
              <Link
                href={`/entries/${nav.prev.id}`}
                title={nav.prev.title}
                className="rounded-full border border-ink/15 bg-white px-2.5 py-1 text-ink/60 transition hover:border-ink/40 hover:text-ink"
              >
                ← 이전
              </Link>
            ) : (
              <span className="rounded-full border border-ink/5 px-2.5 py-1 text-ink/25">← 이전</span>
            )}
            {nav.next ? (
              <Link
                href={`/entries/${nav.next.id}`}
                title={nav.next.title}
                className="rounded-full border border-ink/15 bg-white px-2.5 py-1 text-ink/60 transition hover:border-ink/40 hover:text-ink"
              >
                다음 →
              </Link>
            ) : (
              <span className="rounded-full border border-ink/5 px-2.5 py-1 text-ink/25">다음 →</span>
            )}
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <TierBadge tier={entry.tier} />
        <CategoryBadge categoryKey={entry.categoryKey} />
        <span className="text-xs text-ink/50">
          v{entry.contentVersion} · 최근 수정: {new Date(entry.updatedAt).toLocaleString("ko-KR")}
        </span>
        <span
          className={`rounded-full px-2 py-1 text-[10px] ${
            entry.status === "reviewed" && !reviewOverdue
              ? "bg-emerald-100 text-emerald-800"
              : "bg-amber-100 text-amber-800"
          }`}
        >
          {reviewOverdue
            ? "재검토 기한 경과"
            : entry.status === "reviewed"
              ? `검토 완료${entry.reviewedBy ? ` · ${entry.reviewedBy}` : ""}`
              : "AI/사용자 초안"}
        </span>
      </div>

      {(reviewOverdue || expiredSources.length > 0 || conflictingClaims.length > 0) && (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">임상 적용 전 재확인이 필요합니다.</p>
          <ul className="mt-1 list-inside list-disc">
            {reviewOverdue && <li>노트의 재검토 기한이 지났습니다.</li>}
            {expiredSources.length > 0 && (
              <li>유효 기한이 지난 출처가 {expiredSources.length}개 있습니다.</li>
            )}
            {conflictingClaims.length > 0 && (
              <li>상충 가능성이 표시된 claim이 {conflictingClaims.length}개 있습니다.</li>
            )}
          </ul>
        </div>
      )}

      <h1 className="mb-4 font-serifa text-2xl font-bold tracking-tight text-inkdeep md:text-3xl">{entry.title}</h1>

      <section className="card mb-5 p-6" aria-label="빠른 확인">
        <h2 className="mb-2 font-semibold">빠른 확인 · 본문 발췌</h2>
        <p className="leading-relaxed">{noteExcerpt(entry.content, 420)}</p>
        <p className="mt-3 text-xs text-ink/65">자동 요약이 아닌 본문 앞부분입니다. 상세 내용과 근거를 함께 확인하세요.</p>
        <a href="#entry-evidence" className="mt-3 inline-block text-sm underline">출처·근거 보기 →</a>
      </section>
      <details className="card mb-8 p-6">
        <summary className="cursor-pointer font-semibold">전체 내용 펼치기</summary>
      <article className="mt-4">
        <MarkdownContent content={entry.content} />
      </article>
      </details>

      <div id="entry-evidence" className="scroll-mt-32" />
      {entry.sources.length === 0 && <p className="mb-6 text-sm text-amber-800">등록된 출처가 없습니다.</p>}

      {images.length > 0 && <section className="mb-8"><h2 className="mb-3 font-semibold">원문 도판</h2><div className="grid gap-4 sm:grid-cols-2">{images.map(f => <a key={f.id} href={`/api/figures/${f.id}`} target="_blank" rel="noreferrer" className="rounded-lg border p-3"><img src={`/api/figures/${f.id}`} alt={f.caption} className="max-h-64 w-full object-contain" loading="lazy" /><p className="mt-2 text-sm">{f.caption}{f.page ? ` · p.${f.page}` : ""}</p></a>)}</div></section>}
      <AnatomyNoteLinks entryId={id} tags={entry.tags} />
      {/* Spaced-repetition flashcards from this note */}
      <section className="mb-8 rounded-2xl border border-ink/10 bg-mist/40 p-4">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-ink/40">
          🎴 능동 학습 — 이 노트를 플래시카드로
        </p>
        <CardActions entryId={entry.id} initialCount={cards.length} />
      </section>

      {entry.sources.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-2 text-sm font-medium text-ink/80">출처 (Sources)</h2>
          <ul className="list-inside list-disc space-y-1 text-sm text-ink/60">
            {entry.sources.map((source) => (
              <li key={source.id}>
                {source.citation}
                {source.versionLabel && <span> · {source.versionLabel}</span>}
                {source.evidenceLevel && source.evidenceLevel !== "unknown" && (
                  <span> · {source.evidenceLevel}</span>
                )}
                {source.validUntil && <span> · 유효기한 {source.validUntil}</span>}
                {source.url && (
                  <a href={source.url} className="ml-1 text-emerald-700 hover:underline">
                    link
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {entry.claims.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-2 text-sm font-medium text-ink/80">
            근거 추적 (Claim provenance)
          </h2>
          <div className="space-y-3">
            {entry.claims.map((claim) => (
              <article
                key={claim.id}
                id={`claim-${claim.id}`}
                className={`scroll-mt-24 rounded-xl border p-4 text-sm ${
                  claim.conflictStatus !== "none"
                    ? "border-amber-300 bg-amber-50"
                    : "border-ink/10 bg-mist/30"
                }`}
              >
                <div className="mb-1 flex flex-wrap gap-1.5 text-[10px]">
                  <span className="rounded bg-white px-1.5 py-0.5">
                    {claim.representation === "verbatim" ? "원문 보존" : claim.representation === "author_note" ? "작성자 메모" : "AI 재서술"}
                  </span>
                  <span className="rounded bg-white px-1.5 py-0.5">{claim.evidenceLevel}</span>
                  {claim.conflictStatus !== "none" && (
                    <span className="rounded bg-amber-200 px-1.5 py-0.5 font-semibold">
                      상충 {claim.conflictStatus}
                    </span>
                  )}
                </div>
                <p className="font-medium text-inkdeep">{claim.claimText}</p>
                <p className="mt-1 text-xs text-ink/55">
                  {claim.sourceLocation}
                  {claim.section ? ` · ${claim.section}` : ""}
                  {claim.pageStart
                    ? ` · p.${claim.pageStart}${claim.pageEnd && claim.pageEnd !== claim.pageStart ? `–${claim.pageEnd}` : ""}`
                    : ""}
                </p>
                {claim.originalQuote && (
                  <blockquote className="mt-2 border-l-2 border-ink/20 pl-3 text-xs text-ink/60">
                    원문: {claim.originalQuote}
                  </blockquote>
                )}
                {claim.conflictNote && (
                  <p className="mt-2 text-xs font-medium text-amber-800">
                    상충 메모: {claim.conflictNote}
                  </p>
                )}
                {(claim.generatedByModel || claim.verifiedBy) && (
                  <p className="mt-2 text-[10px] text-ink/40">
                    {claim.generatedByModel ? `생성 모델 ${claim.generatedByModel}` : ""}
                    {claim.promptVersion ? ` · prompt ${claim.promptVersion}` : ""}
                    {claim.verifiedBy ? ` · 검증 ${claim.verifiedBy}` : ""}
                  </p>
                )}
                <ClaimReviewControls
                  claimId={claim.id}
                  initialConflictStatus={claim.conflictStatus}
                  initialConflictNote={claim.conflictNote}
                  initiallyVerified={Boolean(claim.verifiedAt)}
                />
              </article>
            ))}
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-2 text-sm font-medium text-ink/80">관련 노트 (자동 연결됨)</h2>
          <div className="flex flex-wrap gap-2">
            {related.map((r) => (
              <Link
                key={r.id}
                href={`/entries/${r.id}`}
                className="rounded border border-ink/15 px-2 py-1 text-xs hover:border-ink/30"
              >
                {r.title}
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="mb-8 flex flex-wrap gap-3">
        <Link href={`/entries/${entry.id}/edit`} className="btn-primary !px-4 !py-2">
          수정
        </Link>
        <a
          href={`/api/entries/${entry.id}/export?format=docx`}
          className="btn-secondary !px-4 !py-2"
        >
          Word .docx
        </a>
        <a href={`/api/entries/${entry.id}/export`} className="btn-secondary !px-4 !py-2">
          Markdown .md
        </a>
        <a
          href={`/api/entries/${entry.id}/export?format=html`}
          className="btn-secondary !px-4 !py-2"
        >
          HTML
        </a>
        <form action={deleteEntryAction.bind(null, entry.id)}>
          <button
            type="submit"
            className="rounded border border-red-200 px-3 py-2 text-sm text-red-600 hover:border-red-400"
          >
            삭제
          </button>
        </form>
      </div>

    </div>
  );
}
