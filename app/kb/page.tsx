import Link from "next/link";
import { listEntries } from "../../lib/services/entryService";
import { getLeafCategories } from "../../lib/codex/taxonomy";
import { EntryExplorer } from "../../components/EntryExplorer";
import { IngestDock } from "../../components/IngestDock";
export const dynamic = "force-dynamic";
export default async function DashboardPage() {
  const entries = await listEntries();
  const categories = getLeafCategories();
  return <div>
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-ink/15 pb-6">
      <div><p className="mb-2 font-mono text-xs tracking-widest text-ink/60">KNOWLEDGE / 지식창고</p><h1 className="font-serifa text-3xl font-bold text-inkdeep">진료에 필요한 지식, 바로.</h1><p className="mt-2 text-sm text-ink/65">{entries.length}개 노트 · 검토 대기 {entries.filter(e => e.status === "draft").length}개</p></div>
      <div className="flex gap-3"><Link href="/library" className="btn-secondary">폴더로 보기 →</Link><a href="#ingest-dock" className="btn-secondary">자료 넣기</a></div>
    </header>
    <section id="knowledge-notes" className="scroll-mt-40"><EntryExplorer entries={entries} categories={categories} /></section>
    <section id="ingest-dock" className="mt-16 scroll-mt-28 border-t border-ink/15 pt-6"><h2 className="mb-4 text-lg font-semibold">자료 넣기</h2><IngestDock leafCategories={categories} /></section>
  </div>;
}
