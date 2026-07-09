import Link from "next/link";
import type { CodexEntry } from "../lib/codex/types";
import { TierBadge } from "./TierBadge";
import { CategoryBadge } from "./CategoryBadge";

export function EntryCard({ entry }: { entry: CodexEntry }) {
  return (
    <Link href={`/entries/${entry.id}`} className="card card-lift block h-full p-6">
      <div className="mb-3 flex flex-wrap gap-1.5">
        <TierBadge tier={entry.tier} />
        <CategoryBadge categoryKey={entry.categoryKey} />
        {entry.status === "draft" && (
          <span className="inline-block rounded-full border border-ink/10 px-2.5 py-0.5 text-xs text-ink/40">
            초안
          </span>
        )}
      </div>
      <h3 className="font-serifa text-base font-bold leading-snug text-ink">{entry.title}</h3>
      <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-ink/60">{entry.content}</p>
      <div className="mt-3 flex items-center justify-between text-xs text-ink/40">
        <span>{entry.sources.length > 0 ? `출처 ${entry.sources.length}건` : ""}</span>
        {entry.relatedEntryIds.length > 0 && <span>관련 노트 {entry.relatedEntryIds.length}개</span>}
      </div>
    </Link>
  );
}
