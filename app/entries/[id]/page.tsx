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

  const nav = await clusterNavForEntry(id);
  const cards = await listCardsForEntry(id);

  return (
    <div>
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
          최근 수정: {new Date(entry.updatedAt).toLocaleString("ko-KR")}
        </span>
      </div>

      <h1 className="mb-4 font-serifa text-2xl font-bold tracking-tight text-inkdeep md:text-3xl">{entry.title}</h1>

      <article className="card mb-8 p-6">
        <MarkdownContent content={entry.content} />
      </article>

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
