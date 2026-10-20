// components/bbip/care/CareSection.tsx
"use client";

import { CARE_KINDS } from "../../../lib/bbip/care/fields";
import { caseText, INTERACTION_REVIEW } from "../../../lib/bbip/care/interactions";
import { activeItems, orderReady } from "../../../lib/bbip/care/lint";
import type { BbipSession } from "../../../lib/bbip/types";
import { SheetSection } from "../SheetSection";
import { CareActions } from "./CareActions";
import { CareTable } from "./CareTable";
import type { CareController } from "./useCareOrder";

/** "처방·F/U" block of the consult sheet. */
export function CareSection({ session, care, index }: { session: BbipSession; care: CareController; index: string }) {
  const { order, status, error } = care;
  const context = caseText(session.chips, session.flags);
  const active = order ? activeItems(order.items) : [];
  const confirmed = active.filter((item) => item.confirmed).length;

  return (
    <SheetSection
      id="bbip-care"
      index={index}
      label="처방·F/U"
      note={order ? `${confirmed}/${active.length}행 확인` : "확인한 행만 복사·안내문으로 나갑니다."}
    >
      {status === "generating" && (
        <p className="bbip-caret mb-4 text-[14px] text-ink/65">{order ? "다시 작성하는 중" : "오더를 작성하는 중"}</p>
      )}
      {error && (
        <p role="alert" className="mb-4 text-[15px] leading-relaxed text-red-800">
          {error}{" "}
          {!order && (
            <button
              type="button"
              onClick={() => void care.generate()}
              className="ml-1 font-semibold text-ink underline decoration-ink/30 underline-offset-4 hover:decoration-ink"
            >
              다시 시도
            </button>
          )}
        </p>
      )}
      {order && (
        <>
          {order.caution && (
            <p className="mb-5 border-l-2 border-amber-700 pl-3 text-[15px] leading-relaxed text-amber-900">{order.caution}</p>
          )}
          {order.notices.map((notice) => (
            <p key={notice} className="mb-2 text-[13.5px] text-ink/65">
              {notice}
            </p>
          ))}
          <div className="space-y-8">
            {CARE_KINDS.map((kind) => (
              <CareTable
                key={kind}
                kind={kind}
                items={order.items}
                context={context}
                onChange={(items) => void care.saveItems(items)}
              />
            ))}
          </div>
          {!INTERACTION_REVIEW.reviewedAt && (
            <p className="mt-5 text-[13px] text-ink/65">상호작용 경고는 원장 검토 전 초안 규칙표 기준입니다.</p>
          )}
          <CareActions
            order={order}
            procedures={session.chips.procedures}
            ready={orderReady(order.items, context)}
            busy={status === "generating"}
            onSaveSet={care.saveSet}
            onRegenerate={() => {
              if (order.items.some((item) => item.confirmed) && !window.confirm("확인한 행이 있습니다. 오더를 다시 작성할까요?")) {
                return;
              }
              void care.generate(true);
            }}
          />
        </>
      )}
    </SheetSection>
  );
}
