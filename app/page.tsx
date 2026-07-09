import Link from "next/link";
import { listEntries } from "../lib/services/entryService";
import { getLeafCategories } from "../lib/codex/taxonomy";
import { EntryExplorer } from "../components/EntryExplorer";

// Reads live from SQLite on every request — must not be statically
// prerendered, or newly added entries would stay invisible until a rebuild.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const entries = await listEntries();
  const sorted = [...entries].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const categoryCount = new Set(entries.map((e) => e.categoryKey)).size;

  return (
    <div>
      {/* Hero */}
      <section className="mx-auto max-w-2xl pt-6 text-center md:pt-12">
        <p
          className="mb-3 font-mono text-xs tracking-widest text-ink/60 animate-fade-in-up"
          style={{ animationDelay: "0.1s" }}
        >
          AESTHETIC MEDICINE KNOWLEDGE BASE
        </p>
        <h1
          className="text-[32px] leading-[1.15] tracking-tight text-inkdeep animate-fade-in-up md:text-[44px]"
          style={{ animationDelay: "0.2s" }}
        >
          쌓을수록 <span className="font-serifa font-bold">깊어지고,</span>
          <br />
          넣을수록 <span className="font-serifa font-bold">연결된다.</span>
        </h1>
        <p
          className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-ink/70 animate-fade-in-up md:text-base"
          style={{ animationDelay: "0.3s" }}
        >
          논문, 교과서, 파라미터, 노하우를 넣으면 카테고리와 쓰임별로 정리되고, 겹치는 지식은
          자연스럽게 이어집니다. 정리된 노트는 Obsidian으로 그대로 내보낼 수 있습니다.
        </p>
        <div
          className="mt-6 flex flex-col items-center justify-center gap-3 animate-fade-in-up sm:flex-row"
          style={{ animationDelay: "0.4s" }}
        >
          <Link href="/ingest" className="btn-primary">
            + 자료 넣기 (AI)
          </Link>
          <a href="/api/export/all" className="btn-secondary">
            Obsidian으로 내보내기
          </a>
        </div>
        <div
          className="mt-8 flex items-center justify-center gap-2 text-xs text-ink/50 animate-fade-in-up"
          style={{ animationDelay: "0.5s" }}
        >
          <span className="rounded-full bg-mist px-3 py-1">노트 {entries.length}개</span>
          <span className="rounded-full bg-mist px-3 py-1">카테고리 {categoryCount}곳 사용 중</span>
          <span className="rounded-full bg-mist px-3 py-1">
            분류체계 {getLeafCategories().length}개
          </span>
        </div>
      </section>

      {/* Entries */}
      <section className="mt-14">
        {sorted.length === 0 ? (
          <div className="card mx-auto max-w-lg px-8 py-14 text-center">
            <p className="font-serifa text-lg font-bold text-ink">아직 정리된 자료가 없습니다</p>
            <p className="mt-2 text-sm text-ink/60">
              &quot;자료 넣기&quot;에 논문이나 교과서를 통째로 넣어 첫 노트를 만들어 보세요.
            </p>
          </div>
        ) : (
          <>
            <h2 className="mb-4 text-sm font-medium tracking-wide text-ink/50">노트 탐색</h2>
            <EntryExplorer entries={sorted} categories={getLeafCategories()} />
          </>
        )}
      </section>
    </div>
  );
}
