import Link from "next/link";
import { listEntries } from "../lib/services/entryService";
import { EntryCard } from "../components/EntryCard";

// Reads live from SQLite on every request — must not be statically
// prerendered, or newly added entries would stay invisible until a rebuild.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const entries = await listEntries();
  const sorted = [...entries].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">자료 대시보드</h1>
          <p className="text-sm text-neutral-400">
            총 {entries.length}건의 정리된 자료. 새 자료는 카테고리/난이도(tier)별로 정리되고,
            겹치는 내용은 자동으로 연결됩니다.
          </p>
        </div>
        <div className="flex gap-3">
          <a
            href="/api/export/all"
            className="rounded border border-neutral-700 px-3 py-2 text-sm hover:border-neutral-500"
          >
            전체 Obsidian export (.zip)
          </a>
          <Link
            href="/entries/new"
            className="rounded bg-emerald-700 px-3 py-2 text-sm font-medium hover:bg-emerald-600"
          >
            + 새 자료 추가
          </Link>
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="rounded border border-dashed border-neutral-800 p-8 text-center text-neutral-500">
          아직 정리된 자료가 없습니다. &quot;새 자료 추가&quot;로 첫 자료를 넣어 보세요.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {sorted.map((entry) => (
            <EntryCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
