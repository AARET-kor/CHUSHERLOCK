// components/records/ConsultLog.tsx
import Link from "next/link";
import { chipSummary } from "../../lib/bbip/format";
import type { BbipSession } from "../../lib/bbip/types";

// The day-grouped consult sessions that used to be the 기록 page; now the
// Records page's "Consult Log" tab.

function dayKey(iso: string): string {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function groupByDay(sessions: BbipSession[]): Array<[string, BbipSession[]]> {
  const groups = new Map<string, BbipSession[]>();
  for (const session of sessions) {
    const key = dayKey(session.createdAt);
    groups.set(key, [...(groups.get(key) ?? []), session]);
  }
  return Array.from(groups.entries());
}

export function ConsultLog({ sessions }: { sessions: BbipSession[] }) {
  const days = groupByDay(sessions);
  return (
    <div>
      {sessions.length === 0 ? (
        <div className="border-t border-ink/10 py-16 text-center">
          <p className="font-serifa text-[22px] text-inkdeep">아직 기록이 없습니다.</p>
          <Link
            href="/"
            className="mt-4 inline-block text-[15px] text-ink underline decoration-ink/30 underline-offset-4 hover:decoration-ink"
          >
            Write your first case · 첫 케이스 적기 →
          </Link>
        </div>
      ) : (
        days.map(([day, items]) => (
          <section
            key={day}
            aria-label={day}
            className="grid gap-x-10 gap-y-3 border-t border-ink/10 pb-8 pt-6 md:grid-cols-[190px_minmax(0,1fr)] lg:grid-cols-[250px_minmax(0,1fr)]"
          >
            <h2 className="text-[14.5px] font-medium text-ink/60">{day}</h2>
            <ul>
              {items.map((session) => {
                const contra = session.flags.filter((f) => f.level === "contraindication").length;
                const caution = session.flags.length - contra;
                return (
                  <li key={session.id} className="border-b border-ink/[0.07] last:border-b-0">
                    <Link href={`/?s=${session.id}`} className="group flex items-baseline gap-5 py-3">
                      <span className="w-11 shrink-0 font-mono text-[12.5px] tabular-nums text-ink/50">
                        {timeOf(session.createdAt)}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-serifa text-[19px] text-inkdeep underline-offset-[5px] group-hover:underline">
                        {chipSummary(session.chips) || "케이스"}
                      </span>
                      <span className="hidden shrink-0 font-mono text-[12px] sm:inline">
                        {contra > 0 && <span className="text-red-800">Contraindication 금기 {contra}</span>}
                        {contra > 0 && caution > 0 && <span className="text-ink/30"> · </span>}
                        {caution > 0 && <span className="text-amber-800">Caution 주의 {caution}</span>}
                      </span>
                      <span aria-hidden="true" className="font-mono text-[12.5px] text-ink/30 transition group-hover:text-ink">
                        →
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
