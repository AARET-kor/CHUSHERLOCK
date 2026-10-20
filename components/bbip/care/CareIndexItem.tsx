// components/bbip/care/CareIndexItem.tsx
"use client";

import { T } from "../../../lib/bbip/terms";
import { Term } from "../Term";

/** "오더" row in MoreMenu's index: drafts only when pressed. */
export function CareIndexItem({ opened, onOpen }: { opened: boolean; onOpen: () => void }) {
  return (
    <div className="mt-7">
      <p className="mb-1 text-[13.5px] font-semibold text-ink/70"><Term term={T.orders} /></p>
      <button
        type="button"
        disabled={opened}
        onClick={onOpen}
        className="group flex w-full items-baseline justify-between gap-3 border-b border-ink/[0.08] py-2.5 text-left transition disabled:cursor-default"
      >
        <span className="text-[16.5px] text-ink underline-offset-4 group-hover:underline group-disabled:text-ink/35 group-disabled:no-underline">
          <Term term={T.careIndex} />
          <span className="ml-3 text-[14px] text-ink/65 group-disabled:text-ink/35">
            약·처치·이럴 때는·재방문, 누를 때만 작성
          </span>
        </span>
        <span aria-hidden="true" className="font-mono text-[12.5px] text-ink/30 transition group-hover:text-ink">
          {opened ? T.opened.en : "→"}
        </span>
      </button>
    </div>
  );
}
