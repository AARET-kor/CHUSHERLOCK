// app/care-sets/page.tsx
import { CareSetList } from "../../components/bbip/care/CareSetList";
import { INTERACTION_REVIEW } from "../../lib/bbip/care/interactions";
import { listCareSets } from "../../lib/services/careService";

// Reads live from SQLite — never prerender.
export const dynamic = "force-dynamic";

export default function CareSetsPage() {
  const sets = listCareSets();
  return (
    <div className="mx-auto max-w-[900px] pb-16 pt-2 md:pt-8">
      <h1 className="font-serifa text-[34px] font-bold leading-tight text-inkdeep">내 처방 세트</h1>
      <p className="mt-3 max-w-[620px] text-[15.5px] leading-relaxed text-ink/65">
        확인한 오더를 시술별로 저장한 세트입니다. 같은 시술의 케이스에서 처방·드레싱·F/U를 열면 이 세트로 시작하고, AI는 그 케이스에 맞춘 조정만 제안합니다.
      </p>
      {!INTERACTION_REVIEW.reviewedAt && (
        <p className="mt-2 text-[14px] text-amber-900">상호작용 경고 규칙표는 원장 검토 전 초안입니다 (lib/bbip/care/interactions.ts).</p>
      )}
      <CareSetList sets={sets} />
    </div>
  );
}
