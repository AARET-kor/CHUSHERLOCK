import { listClusters, noteDigest } from "../../lib/services/clusterService";
import { listEntries } from "../../lib/services/entryService";
import { listCardsForEntries } from "../../lib/services/flashcardService";
import { getCategory } from "../../lib/codex/taxonomy";
import { StudyClient, type StudyCluster, type StudyNote } from "../../components/StudyClient";

// Learning clusters read live from SQLite — never statically prerendered.
export const dynamic = "force-dynamic";

export default async function StudyPage() {
  const [clusters, entries] = await Promise.all([listClusters(), listEntries()]);
  const clusteredEntryIds = Array.from(
    new Set(clusters.flatMap((cluster) => cluster.entries.map((entry) => entry.id)))
  );
  const cards = await listCardsForEntries(clusteredEntryIds);
  const now = new Date().toISOString();
  const cardsByEntry = new Map<string, typeof cards>();

  for (const card of cards) {
    const entryCards = cardsByEntry.get(card.entryId) ?? [];
    entryCards.push(card);
    cardsByEntry.set(card.entryId, entryCards);
  }

  const view: StudyCluster[] = clusters.map((c) => {
    const entryViews = c.entries.map((e) => {
      const entryCards = cardsByEntry.get(e.id) ?? [];
      return {
        id: e.id,
        title: e.title,
        tier: e.tier,
        digest: noteDigest(e.content, 140),
        cardCount: entryCards.length,
        dueCount: entryCards.filter((card) => card.dueAt <= now).length,
        masteredCount: entryCards.filter(
          (card) => card.status === "review" && card.intervalDays >= 21
        ).length,
      };
    });
    const clusterCards = c.entries.flatMap((e) => cardsByEntry.get(e.id) ?? []);
    const dueCards = clusterCards.filter((card) => card.dueAt <= now);
    const preview = dueCards[0] ?? clusterCards[0] ?? null;

    return {
      id: c.id,
      title: c.title,
      description: c.description,
      suggestions: c.suggestions,
      origin: c.origin,
      cardCount: clusterCards.length,
      dueCount: dueCards.length,
      masteredCount: clusterCards.filter(
        (card) => card.status === "review" && card.intervalDays >= 21
      ).length,
      cardReadyNotes: entryViews.filter((entry) => entry.cardCount > 0).length,
      estimatedMinutes: Math.max(5, c.entries.length * 5 + Math.ceil(dueCards.length * 0.5)),
      preview: preview ? { front: preview.front, entryTitle: preview.entryTitle } : null,
      entries: entryViews,
    };
  });

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
