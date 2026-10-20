// components/bbip/care/CareSetList.tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { KIND_LABEL } from "../../../lib/bbip/care/fields";
import { orderLine } from "../../../lib/bbip/care/format";
import type { CareSet } from "../../../lib/bbip/care/types";

export function CareSetList({ sets }: { sets: CareSet[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function remove(set: CareSet) {
    if (!window.confirm(`‘${set.label}’ 세트를 지울까요?`)) return;
    const res = await fetch(`/api/bbip/care-sets/${set.id}`, { method: "DELETE" }).catch(() => null);
    if (!res || (!res.ok && res.status !== 404)) {
      setError("세트를 지우지 못했습니다.");
      return;
    }
    router.refresh();
  }

  if (sets.length === 0) {
    return <p className="mt-10 text-[15px] text-ink/65">저장한 세트가 없습니다. 오더의 모든 행을 확인한 뒤 “내 세트로 저장”을 누르세요.</p>;
  }
  return (
    <div className="mt-10 space-y-10">
      {error && (
        <p role="alert" className="text-[15px] text-red-800">
          {error}
        </p>
      )}
      {sets.map((set) => (
        <section key={set.id} aria-labelledby={`set-${set.id}`} className="border-t border-ink/10 pt-5">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id={`set-${set.id}`} className="font-serifa text-[21px] font-bold text-inkdeep">
              {set.label}
            </h2>
            <button
              type="button"
              onClick={() => void remove(set)}
              className="text-[14px] text-ink/70 underline decoration-ink/20 underline-offset-4 hover:text-red-800"
            >
              삭제
            </button>
          </div>
          <p className="mt-1 text-[13px] text-ink/65">
            {set.items.length}행 · {new Date(set.updatedAt).toLocaleDateString("ko-KR")}
          </p>
          <ul className="mt-3 space-y-1.5">
            {set.items.map((item) => (
              <li key={item.id} className="text-[15px] leading-relaxed text-ink">
                <span className="mr-2 text-[13px] text-ink/65">{KIND_LABEL[item.kind]}</span>
                {orderLine(item)}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
