import { listEntries } from "../lib/services/entryService";
import { getLeafCategories } from "../lib/codex/taxonomy";
import { EntryExplorer } from "../components/EntryExplorer";
import { IngestDock } from "../components/IngestDock";
import { LandingHero } from "../components/LandingHero";
import { ExploreSection } from "../components/ExploreSection";
import { TierChapters } from "../components/TierChapters";

// Reads live from SQLite on every request — must not be statically
// prerendered, or newly added entries would stay invisible until a rebuild.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const entries = await listEntries();
  const sorted = [...entries].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const categoryCount = new Set(entries.map((e) => e.categoryKey)).size;
  const leafCategories = getLeafCategories();

  const tierCounts: Record<string, number> = {};
  for (const entry of entries) {
    tierCounts[entry.tier] = (tierCounts[entry.tier] ?? 0) + 1;
  }

  return (
    <div>
      {/* 01 — editorial hero masthead */}
      <LandingHero
        noteCount={entries.length}
        categoryCount={categoryCount}
        leafTotal={leafCategories.length}
      />

      {/* 02 — the working intake dock */}
      <section id="ingest-dock" className="mt-10 scroll-mt-28">
        <div className="mb-4 flex items-center gap-3 font-mono text-[10px] tracking-[0.2em] md:text-[11px]">
          <span className="text-ink/45">[ 02 ]</span>
          <span className="font-bold uppercase text-ink">자료 넣기 — Drop Anything</span>
        </div>
        <IngestDock leafCategories={leafCategories} />
      </section>

      {/* 03 — recent notes */}
      <section className="mt-24">
        {sorted.length === 0 ? (
          <p className="mx-auto max-w-md text-center text-sm text-ink/40">
            아직 노트가 없습니다 — 위에 첫 자료를 던져 넣어 보세요.
          </p>
        ) : (
          <>
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="font-mono text-[10px] tracking-[0.2em] md:text-[11px]">
                <span className="text-ink/45">[ 03 ]</span>{" "}
                <span className="font-bold uppercase text-ink">Knowledge — 노트 탐색</span>
              </h2>
              <a
                href="/library"
                className="text-xs text-ink/50 underline-offset-4 hover:text-ink hover:underline"
              >
                폴더로 보기 →
              </a>
            </div>
            <EntryExplorer entries={sorted} categories={leafCategories} />
          </>
        )}
      </section>

      {/* 04 — explore statement */}
      <ExploreSection />

      {/* 05 — the four tiers, museum-gallery style */}
      <TierChapters tierCounts={tierCounts} />
    </div>
  );
}
