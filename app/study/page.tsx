import { listClusters, noteDigest } from "../../lib/services/clusterService";
import { StudyClient, type StudyCluster } from "../../components/StudyClient";

// Learning clusters read live from SQLite — never statically prerendered.
export const dynamic = "force-dynamic";

export default async function StudyPage() {
  const clusters = await listClusters();

  const view: StudyCluster[] = clusters.map((c) => ({
    id: c.id,
    title: c.title,
    description: c.description,
    suggestions: c.suggestions,
    entries: c.entries.map((e) => ({
      id: e.id,
      title: e.title,
      tier: e.tier,
      digest: noteDigest(e.content, 140),
    })),
  }));

  return (
    <div>
      <StudyClient clusters={view} />
    </div>
  );
}
