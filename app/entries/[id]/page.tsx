import Link from "next/link";
import { notFound } from "next/navigation";
import { getEntry, listEntries } from "../../../lib/services/entryService";
import { entryToMarkdown } from "../../../lib/codex/markdown-export";
import { TierBadge } from "../../../components/TierBadge";
import { CategoryBadge } from "../../../components/CategoryBadge";
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
        <span className="text-xs text-neutral-500">
          최근 수정: {new Date(entry.updatedAt).toLocaleString("ko-KR")}
        </span>
      </div>

      <h1 className="mb-4 text-2xl font-semibold">{entry.title}</h1>

      <article className="mb-8 whitespace-pre-wrap rounded-lg border border-neutral-800 p-5 text-sm leading-relaxed">
        {entry.content}
      </article>

      {entry.sources.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-2 text-sm font-medium text-neutral-300">출처 (Sources)</h2>
          <ul className="list-inside list-disc space-y-1 text-sm text-neutral-400">
            {entry.sources.map((source) => (
              <li key={source.id}>
                {source.citation}
                {source.url && (
                  <a href={source.url} className="ml-1 text-emerald-400 hover:underline">
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
          <h2 className="mb-2 text-sm font-medium text-neutral-300">관련 노트 (자동 연결됨)</h2>
          <div className="flex flex-wrap gap-2">
            {related.map((r) => (
              <Link
                key={r.id}
                href={`/entries/${r.id}`}
                className="rounded border border-neutral-700 px-2 py-1 text-xs hover:border-neutral-500"
              >
                {r.title}
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="mb-8 flex flex-wrap gap-3">
        <a
          href={`/api/entries/${entry.id}/export`}
          className="rounded border border-neutral-700 px-3 py-2 text-sm hover:border-neutral-500"
        >
          Obsidian .md export
        </a>
        <form action={deleteEntryAction.bind(null, entry.id)}>
          <button
            type="submit"
            className="rounded border border-red-800 px-3 py-2 text-sm text-red-300 hover:border-red-600"
          >
            삭제
          </button>
        </form>
      </div>

      <details className="rounded-lg border border-neutral-800 p-4">
        <summary className="cursor-pointer text-sm font-medium text-neutral-300">
          Markdown 미리보기 ({markdownPreview.relativePath})
        </summary>
        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs text-neutral-400">
          {markdownPreview.content}
        </pre>
      </details>
    </div>
  );
}
