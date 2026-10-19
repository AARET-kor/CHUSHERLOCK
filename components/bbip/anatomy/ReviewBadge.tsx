import { BadgeCheck, FilePenLine } from "lucide-react";
import { isReviewed, type AtlasStructure } from "../../../lib/bbip/anatomy/atlas";

/** Atlas entries stay drafts until the doctor fills reviewedBy/reviewedAt. */
export function ReviewBadge({ structure }: { structure: Pick<AtlasStructure, "reviewedBy" | "reviewedAt"> }) {
  if (isReviewed(structure)) {
    return (
      <span
        title={`${structure.reviewedBy} · ${structure.reviewedAt}`}
        className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-emerald-50 px-1.5 py-px font-mono text-[10px] font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200"
      >
        <BadgeCheck aria-hidden="true" className="h-3 w-3" />
        원장 검토됨
      </span>
    );
  }
  return (
    <span
      title="표준 해부학 지식으로 작성한 초안 — 원장이 검토하면 배지가 사라집니다"
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-amber-50 px-1.5 py-px font-mono text-[10px] font-semibold text-amber-900 ring-1 ring-inset ring-amber-300"
    >
      <FilePenLine aria-hidden="true" className="h-3 w-3" />
      원장 검토 전 초안
    </span>
  );
}
