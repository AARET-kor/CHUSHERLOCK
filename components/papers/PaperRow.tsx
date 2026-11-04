// components/papers/PaperRow.tsx
import Link from "next/link";
import { LEVEL_LABEL } from "../../lib/bbip/literature/refs";
import { ifText, REVIEW_LABEL, SOURCE_LABEL, statusText, SUBJECT_LABEL } from "../../lib/papers/labels";
import type { PaperRow as Paper } from "../../lib/papers/types";
import { AnalyzeButton } from "./AnalyzeButton";
import { TopicTag } from "./TopicTag";

export function PaperRow({ paper }: { paper: Paper }) {
  const { analysis } = paper;
  return (
    <li className="grid gap-x-5 gap-y-1 border-b border-ink/[0.07] py-3 sm:grid-cols-[88px_minmax(0,1fr)]">
      <span className="font-mono text-[14px] tabular-nums text-inkdeep">{ifText(paper.impactFactor)}</span>
      <div className="min-w-0">
        <Link href={`/papers/${paper.pmid}`} className="font-serifa text-[18px] leading-snug text-inkdeep hover:underline">
          {paper.title}
        </Link>
        <p className="mt-0.5 text-[14px] text-ink/70">
          {[paper.journalTa, paper.year, LEVEL_LABEL[paper.level]].filter(Boolean).join(" · ")}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12.5px]">
          {paper.topics.map((topic) => <TopicTag key={topic} topic={topic} />)}
          {analysis ? (
            <>
              <span className="rounded-full bg-mist px-2 py-0.5 text-ink/80">
                {SUBJECT_LABEL[analysis.subject.kind].en} {SUBJECT_LABEL[analysis.subject.kind].ko}
                {analysis.subject.n ? ` n=${analysis.subject.n}` : ""}
              </span>
              {analysis.followUp && <span className="rounded-full bg-mist px-2 py-0.5 text-ink/80">F/U {analysis.followUp}</span>}
              <span className="rounded-full bg-mist px-2 py-0.5 text-ink/80">{SOURCE_LABEL[analysis.source].ko}</span>
              <span className="rounded-full bg-mist px-2 py-0.5 text-ink/80">{REVIEW_LABEL[paper.reviewStatus].en} {REVIEW_LABEL[paper.reviewStatus].ko}</span>
            </>
          ) : (
            <>
              <span className="text-ink/65">{statusText(paper.status)}</span>
              {paper.status !== "analyzing" && <AnalyzeButton pmid={paper.pmid} retry={paper.status === "failed"} />}
            </>
          )}
        </div>
      </div>
    </li>
  );
}
