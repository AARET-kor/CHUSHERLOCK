import Link from "next/link";
import { notFound } from "next/navigation";
import { getEntry, listEntries } from "../../../lib/services/entryService";
import { entryToMarkdown } from "../../../lib/codex/markdown-export";
import { TierBadge } from "../../../components/TierBadge";
import { CategoryBadge } from "../../../components/CategoryBadge";
import { MarkdownContent } from "../../../components/MarkdownContent";
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
  const titleById = new Map(allEntries.map((e) => [e.id, e.title]));
  const related = entry.relatedEntryIds
    .map((relatedId) => allEntries.find((e) => e.id === relatedId))
    .filter((e): e is NonNullable<typeof e> => Boolean(e));

  const markdownPreview = entryToMarkdown(entry, titleById);

  return (
    <div>
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
          href={`/api/entries/${entry.id}/export`}
          className="btn-secondary !px-4 !py-2"
        >
          Obsidian .md export
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

      <details className="card p-5">
        <summary className="cursor-pointer text-sm font-medium text-ink/80">
          Markdown 미리보기 ({markdownPreview.relativePath})
        </summary>
        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs text-ink/60">
          {markdownPreview.content}
        </pre>
      </details>
    </div>
  );
}
