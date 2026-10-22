// components/records/FollowUpStrip.tsx
import Link from "next/link";
import type { FollowUpItem } from "../../lib/records/types";
import { Term } from "../bbip/Term";
import { T } from "../../lib/bbip/terms";
import { CategoryTag } from "./CategoryTag";

const STATUS = {
  overdue: { label: "Overdue · 지남", className: "text-red-800" },
  today: { label: "Today · 오늘", className: "text-[#0f5132] font-semibold" },
  week: { label: "This week · 이번 주", className: "text-ink/70" },
} as const;

/** Follow-ups due within a week (and overdue ones), soonest first. */
export function FollowUpStrip({ items }: { items: FollowUpItem[] }) {
  return (
    <section aria-labelledby="records-fu" className="border-t border-ink/10 pb-8 pt-6">
      <h2 id="records-fu" className="mb-3 text-[14.5px] font-semibold text-ink/70">
        <Term term={T.followUps} />
      </h2>
      {items.length === 0 ? (
        <p className="text-[14.5px] text-ink/60">이번 주 예정된 F/U가 없습니다.</p>
      ) : (
        <ul className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const status = STATUS[item.status as keyof typeof STATUS];
            return (
              <li key={`${item.courseId}-${item.date}`} className="border-b border-ink/[0.07]">
                <Link href={`/patients/${item.patient.id}/courses/${item.courseId}`} className="group flex items-baseline gap-3 py-2.5">
                  <span className="w-14 shrink-0 font-mono text-[12.5px] tabular-nums text-ink/60">{item.date.slice(5)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15.5px] text-inkdeep group-hover:underline">
                      #{item.patient.chartNo} {item.patient.alias}
                    </span>
                    <span className="mt-1 flex">
                      <CategoryTag procedure={item.procedure} size="sm" compact />
                    </span>
                  </span>
                  <span className={`shrink-0 text-[12.5px] ${status?.className ?? ""}`}>{status?.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
