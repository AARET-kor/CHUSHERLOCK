import { listEntries } from "../lib/services/entryService";
import { getLeafCategories } from "../lib/codex/taxonomy";
import { EntryExplorer } from "../components/EntryExplorer";
import { IngestDock } from "../components/IngestDock";

// Reads live from SQLite on every request — must not be statically
// prerendered, or newly added entries would stay invisible until a rebuild.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const entries = await listEntries();
  const sorted = [...entries].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const categoryCount = new Set(entries.map((e) => e.categoryKey)).size;
  const leafCategories = getLeafCategories();

  return (
    <div>
      {/* Dark hero band with the intake dock overlapping its lower edge. */}
      <section className="relative">
        <div className="relative overflow-hidden rounded-[32px] bg-inkdeep px-6 pb-24 pt-12 text-white md:px-14 md:pt-16">
          <div className="hero-glow pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/[0.06] blur-3xl" />
          <div
            className="hero-glow pointer-events-none absolute -bottom-32 -left-16 h-72 w-72 rounded-full bg-emerald-400/[0.07] blur-3xl"
            style={{ animationDelay: "-4.5s" }}
          />

          <p
            className="mb-4 font-mono text-[11px] tracking-[0.25em] text-white/50 animate-fade-in-up"
            style={{ animationDelay: "0.05s" }}
          >
            COGNITIO — AESTHETIC MEDICINE KNOWLEDGE ENGINE
          </p>
          <h1
            className="max-w-2xl text-[34px] leading-[1.12] tracking-tight animate-fade-in-up md:text-[52px]"
            style={{ animationDelay: "0.15s" }}
          >
            던져 넣으면,
            <br />
            <span className="font-serifa font-bold italic">정리되어 연결된다.</span>
          </h1>
          <p
            className="mt-5 max-w-lg text-sm leading-relaxed text-white/60 animate-fade-in-up md:text-base"
            style={{ animationDelay: "0.25s" }}
          >
            논문·교과서·파라미터·노하우를 그대로 던져 넣으세요. AI가 문서 흐름을 읽고
            카테고리·쓰임별로 정리하며, 그림과 표는 원본 그대로 잘라 노트에 담습니다.
          </p>
          <div
            className="mt-6 flex flex-wrap gap-2 animate-fade-in-up"
            style={{ animationDelay: "0.35s" }}
          >
            <span className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/60">
              노트 {entries.length}
            </span>
            <span className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/60">
              카테고리 {categoryCount} / {leafCategories.length}
            </span>
            <a
              href="/api/export/all"
              className="rounded-full border border-white/25 px-3 py-1 text-xs text-white/80 transition hover:border-white/60 hover:text-white"
            >
              Obsidian으로 내보내기 ↓
            </a>
          </div>
        </div>

        <div
          className="relative z-10 -mt-14 px-3 animate-fade-in-up md:px-10"
          style={{ animationDelay: "0.45s" }}
        >
          <IngestDock leafCategories={leafCategories} />
        </div>
      </section>

      {/* Entries */}
      <section className="mt-16">
        {sorted.length === 0 ? (
          <p className="mx-auto max-w-md text-center text-sm text-ink/40">
            아직 노트가 없습니다 — 위에 첫 자료를 던져 넣어 보세요.
          </p>
        ) : (
          <>
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="font-mono text-[11px] tracking-[0.25em] text-ink/40">
                KNOWLEDGE — 노트 탐색
              </h2>
              <a href="/library" className="text-xs text-ink/50 underline-offset-4 hover:text-ink hover:underline">
                폴더로 보기 →
              </a>
            </div>
            <EntryExplorer entries={sorted} categories={leafCategories} />
          </>
        )}
      </section>
    </div>
  );
}
