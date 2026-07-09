import Link from "next/link";
import type { CodexEntry } from "../lib/codex/types";
import { TierBadge } from "./TierBadge";
import { CategoryBadge } from "./CategoryBadge";

export function EntryCard({ entry }: { entry: CodexEntry }) {
  return (
    <Link
      href={`/entries/${entry.id}`}
      className="block rounded-lg border border-neutral-800 p-4 hover:border-neutral-600"
    >
      <div className="mb-2 flex flex-wrap gap-2">
        <TierBadge tier={entry.tier} />
        <CategoryBadge categoryKey={entry.categoryKey} />
        {entry.status === "draft" && (
          <span className="inline-block rounded border border-neutral-700 px-2 py-0.5 text-xs text-neutral-400">
            초안
          </span>
        )}
      </div>
      <h3 className="text-base font-medium">{entry.title}</h3>
      <p className="mt-1 line-clamp-2 text-sm text-neutral-400">{entry.content}</p>
      {entry.sources.length > 0 && (
        <p className="mt-2 text-xs text-neutral-500">출처 {entry.sources.length}건</p>
      )}
    </Link>
  );
}
