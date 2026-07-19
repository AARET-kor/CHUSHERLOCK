import { listClusters, noteDigest } from "../../lib/services/clusterService";
import { listEntries } from "../../lib/services/entryService";
import { getCategory } from "../../lib/codex/taxonomy";
import { StudyClient, type StudyCluster, type StudyNote } from "../../components/StudyClient";

// Learning clusters read live from SQLite — never statically prerendered.
export const dynamic = "force-dynamic";

export default async function StudyPage() {
  const [clusters, entries] = await Promise.all([listClusters(), listEntries()]);

  const view: StudyCluster[] = clusters.map((c) => ({
    id: c.id,
    title: c.title,
    description: c.description,
    suggestions: c.suggestions,
    origin: c.origin,
    entries: c.entries.map((e) => ({
      id: e.id,
      title: e.title,
      tier: e.tier,
      digest: noteDigest(e.content, 140),
    })),
  }));

  const allNotes: StudyNote[] = entries
    .map((e) => ({
      id: e.id,
      title: e.title,
      categoryLabel: getCategory(e.categoryKey).labelKo,
      tier: e.tier,
    }))
    .sort((a, b) => a.title.localeCompare(b.title, "ko"));

  return (
    <div>
      <StudyClient clusters={view} allNotes={allNotes} />
    </div>
  );
}
