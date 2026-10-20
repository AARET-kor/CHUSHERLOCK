import { isReviewed, type AtlasStructure } from "../../../lib/bbip/anatomy/atlas";

/** Atlas entries stay drafts until the doctor fills reviewedBy/reviewedAt.
 * Same italic ochre the sheet uses for unreviewed material. */
export function ReviewBadge({ structure }: { structure: Pick<AtlasStructure, "reviewedBy" | "reviewedAt"> }) {
  if (isReviewed(structure)) {
    return (
      <span title={`${structure.reviewedBy} · ${structure.reviewedAt}`} className="whitespace-nowrap text-[13px] text-[#0f5132]">
        Reviewed · 원장 검토됨
      </span>
    );
  }
  return (
    <span
      title="표준 해부학 지식으로 작성한 초안 — 원장이 검토하면 표시가 사라집니다"
      className="whitespace-nowrap text-[13px] italic text-[#8a5a00]"
    >
      Draft · 원장 검토 전 초안
    </span>
  );
}
