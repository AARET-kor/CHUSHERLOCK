import Link from "next/link";
import type { CodexEntry } from "../lib/codex/types";
import { noteExcerpt } from "../lib/knowledge/preview";
import { TierBadge } from "./TierBadge";
import { CategoryBadge } from "./CategoryBadge";

export function EntryCard({ entry }: { entry: CodexEntry }) {
  return (
    <Link href={`/entries/${entry.id}`} className="card card-lift block p-6">
      <div className="mb-3 flex flex-wrap gap-1.5">
        <TierBadge tier={entry.tier} />
        <CategoryBadge categoryKey={entry.categoryKey} />
        <span className="inline-block rounded-full border border-ink/10 px-2.5 py-0.5 text-xs text-ink/40">
            {entry.status === "draft" ? "검토 대기" : "검토 완료"}
        </span>
      </div>
      <h3 className="font-serifa text-base font-bold leading-snug text-ink">{entry.title}</h3>
      <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-ink/60">
        {noteExcerpt(entry.content)}
      </p>
      <p className="mt-2 text-xs text-ink/60">{entry.reviewedAt ? `검토일 ${entry.reviewedAt.slice(0, 10)}` : "검토일 미등록"} · 수정 {entry.updatedAt.slice(0, 10)}</p>
      <div className="mt-3 flex items-center justify-between text-xs text-ink/40">
        <span>{entry.sources.length > 0 ? `출처 ${entry.sources.length}건` : "출처 미등록"}</span>
        {entry.relatedEntryIds.length > 0 && <span>관련 노트 {entry.relatedEntryIds.length}개</span>}
      </div>
    </Link>
  );
}
