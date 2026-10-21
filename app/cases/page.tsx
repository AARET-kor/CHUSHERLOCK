// app/cases/page.tsx
import Link from "next/link";
import { ConsultLog } from "../../components/records/ConsultLog";
import { FollowUpStrip } from "../../components/records/FollowUpStrip";
import { RecordsHome } from "../../components/records/RecordsHome";
import { Term } from "../../components/bbip/Term";
import { T } from "../../lib/bbip/terms";
import { addDays, todayIso } from "../../lib/records/schedule";
import { listSessions } from "../../lib/services/bbipService";
import { listFollowUps, listPatientSummaries } from "../../lib/services/recordsService";

// Reads live from SQLite — never prerender.
export const dynamic = "force-dynamic";

export default async function RecordsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const tab = (await searchParams).tab === "consults" ? "consults" : "patients";
  const today = todayIso();
  return (
    <div>
      <header className="pb-10 pt-2 md:pt-6">
        <div className="mb-7 flex items-center gap-3 text-[14px] text-ink/60">
          BBIP
          <span className="h-px w-12 bg-ink/25" />
          <Term term={T.records} />
        </div>
        <h1 className="break-keep text-[2.7rem] leading-[1.08] tracking-tight text-ink md:text-[3.9rem]">
          Every patient,
          <br />
          <span className="font-serifa font-bold italic">picked up where you left off.</span>
          <span lang="ko" className="mt-3 block text-[0.42em] font-normal leading-snug tracking-normal text-ink/60">
            환자마다, <span className="font-serifa font-bold italic">지난번 그 자리에서 이어서.</span>
          </span>
        </h1>
        <nav aria-label="기록 보기" className="mt-8 flex gap-6 text-[15px]">
          {[
            { key: "patients", href: "/cases", term: T.patients },
            { key: "consults", href: "/cases?tab=consults", term: T.consultLog },
          ].map((item) => (
            <Link
              key={item.key}
              href={item.href}
              aria-current={tab === item.key ? "page" : undefined}
              className={tab === item.key ? "font-semibold text-inkdeep underline decoration-[1.5px] underline-offset-[6px]" : "text-ink/65 hover:text-ink"}
            >
              <Term term={item.term} />
            </Link>
          ))}
        </nav>
      </header>
      {tab === "patients" ? (
        <>
          <FollowUpStrip items={listFollowUps(today)} />
          <RecordsHome summaries={listPatientSummaries()} weekEnd={addDays(today, 7)} />
        </>
      ) : (
        <ConsultLog sessions={listSessions(200)} />
      )}
    </div>
  );
}
