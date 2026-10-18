import { randomUUID } from "node:crypto";
import { BbipConsole } from "../components/bbip/BbipConsole";
import { loadSessionView } from "../lib/bbip/openSession";
import { getLeafCategories } from "../lib/codex/taxonomy";

// Reads live from SQLite (history sessions) — never prerender.
export const dynamic = "force-dynamic";

export default async function BbipPage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s } = await searchParams;
  const view = s ? await loadSessionView(s) : null;
  // A fresh key per server render remounts the console on every navigation
  // ("＋ 새 케이스", history links). In-tab sessions update the URL with
  // history.replaceState, which never re-renders this page, so they keep state.
  return (
    <BbipConsole
      key={randomUUID()}
      initialView={view}
      leafCategories={getLeafCategories()}
    />
  );
}
