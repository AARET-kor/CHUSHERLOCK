import Link from "next/link";
import { chipSummary } from "../../lib/bbip/format";
import type { BbipSession } from "../../lib/bbip/types";
import { listSessions } from "../../lib/services/bbipService";

// Reads live from SQLite — never prerender.
export const dynamic = "force-dynamic";

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

export default function CasesPage() {
  const sessions = listSessions(200);
  const days = groupByDay(sessions);

  return (
    <div>
      <header className="pb-12 pt-2 md:pt-6">
        <div className="mb-7 flex items-center gap-3 text-[14px] text-ink/60">
          BBIP
          <span className="h-px w-12 bg-ink/25" />
          케이스 기록
        </div>
        <h1 className="break-keep text-[2.7rem] leading-[1.08] tracking-tight text-ink md:text-[3.9rem]">
          지나간 케이스,
          <br />
          <span className="font-serifa font-bold italic">그대로 다시.</span>
        </h1>
        <p className="mt-6 max-w-[540px] text-[15.5px] leading-[1.75] text-ink/60">
          열었던 케이스와 펼쳐 본 내용이 그대로 남아 있습니다. 입력 원문은 저장하지 않고, 정리된 항목만 보관합니다.
        </p>
      </header>

      {sessions.length === 0 ? (
        <div className="border-t border-ink/10 py-16 text-center">
          <p className="font-serifa text-[22px] text-inkdeep">아직 기록이 없습니다.</p>
          <Link
            href="/"
            className="mt-4 inline-block text-[15px] text-ink underline decoration-ink/30 underline-offset-4 hover:decoration-ink"
          >
            첫 케이스 적기 →
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
                        {contra > 0 && <span className="text-red-800">금기 {contra}</span>}
                        {contra > 0 && caution > 0 && <span className="text-ink/30"> · </span>}
                        {caution > 0 && <span className="text-amber-800">주의 {caution}</span>}
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
