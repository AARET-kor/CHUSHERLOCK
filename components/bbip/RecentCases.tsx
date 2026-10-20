"use client";

import Link from "next/link";
import { chipSummary, formatSessionTime } from "../../lib/bbip/format";
import type { BbipSession } from "../../lib/bbip/types";
import { T } from "../../lib/bbip/terms";
import { Term } from "./Term";

/** The masthead's right column: a quiet list of the latest cases. */
export function RecentCases({
  sessions,
  activeId,
}: {
  sessions: BbipSession[];
  activeId: string | null;
}) {
  return (
    <aside aria-labelledby="bbip-recent" className="md:pt-1">
      <div className="flex items-baseline justify-between border-b border-ink/20 pb-2">
        <h2 id="bbip-recent" className="font-mono text-[11.5px] font-bold uppercase tracking-[0.2em] text-ink">
          <Term term={T.recent} koClassName="font-sans normal-case tracking-normal" />
        </h2>
        <Link href="/" className="text-right text-[14px] text-ink underline-offset-4 hover:underline">
          <Term term={{ en: `＋ ${T.newCase.en}`, ko: T.newCase.ko }} />
        </Link>
      </div>
      {sessions.length === 0 ? (
        <p className="py-3 text-[14px] text-ink/65">아직 기록이 없습니다.</p>
      ) : (
        <ul>
          {sessions.slice(0, 5).map((session) => {
            const active = session.id === activeId;
            const contra = session.flags.some((f) => f.level === "contraindication");
            return (
              <li key={session.id} className="border-b border-ink/[0.07]">
                <Link
                  href={`/?s=${session.id}`}
                  aria-current={active ? "page" : undefined}
                  className="group block py-2.5"
                >
                  <span
                    className={`block truncate text-[15px] underline-offset-4 group-hover:underline ${
                      active ? "font-semibold text-inkdeep" : "text-ink/80"
                    }`}
                  >
                    {chipSummary(session.chips) || "케이스"}
                  </span>
                  <span className="font-mono text-[11.5px] text-ink/50">
                    {formatSessionTime(session.createdAt)}
                    {contra && <span className="text-red-800"> · {T.contraindication.en} 금기</span>}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <Link
        href="/cases"
        className="mt-3 inline-block text-[14px] text-ink/60 transition hover:text-ink"
      >
        <Term term={{ en: `${T.allCases.en} →`, ko: T.allCases.ko }} />
      </Link>
    </aside>
  );
}
