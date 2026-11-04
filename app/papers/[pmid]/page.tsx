// app/papers/[pmid]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { AnalyzeButton } from "../../../components/papers/AnalyzeButton";
import { ReviewButtons } from "../../../components/papers/ReviewButtons";
import { TopicTag } from "../../../components/papers/TopicTag";
import { authorsShort, LEVEL_LABEL, pubmedUrl } from "../../../lib/bbip/literature/refs";
import { ifText, SOURCE_LABEL, statusText, SUBJECT_LABEL } from "../../../lib/papers/labels";
import { getPaper } from "../../../lib/services/paperService";

export const dynamic = "force-dynamic";

function Section({ en, ko, items }: { en: string; ko: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <section className="mt-7">
      <h2 className="text-[14.5px] font-semibold text-ink/70">{en} · {ko}</h2>
      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[16px] leading-relaxed text-ink">
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </section>
  );
}

export default async function PaperPage({ params }: { params: Promise<{ pmid: string }> }) {
  const { pmid } = await params;
  const paper = getPaper(pmid);
  if (!paper) notFound();
  const { analysis } = paper;
  return (
    <article className="max-w-[820px]">
      <Link href="/papers" className="text-[14px] text-ink/60 hover:text-ink">← Papers · 논문</Link>
      <h1 className="mt-5 font-serifa text-[1.9rem] font-bold leading-tight text-inkdeep">{paper.title}</h1>
      <p className="mt-2 text-[15px] text-ink/70">
        {[authorsShort(paper.authors), paper.journalName ?? paper.journalTa, paper.year, LEVEL_LABEL[paper.level], ifText(paper.impactFactor)].filter(Boolean).join(" · ")}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {paper.topics.map((topic) => <TopicTag key={topic} topic={topic} />)}
        <a href={pubmedUrl(paper.pmid)} target="_blank" rel="noopener noreferrer" className="text-[14px] underline underline-offset-4">PubMed</a>
        {paper.doi && <a href={`https://doi.org/${encodeURI(paper.doi)}`} target="_blank" rel="noopener noreferrer" className="text-[14px] underline underline-offset-4">DOI</a>}
      </div>

      {analysis ? (
        <>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-[6px] bg-mist p-3">
            <p className="text-[14px] text-ink/80">
              AI 분석 · {SOURCE_LABEL[analysis.source].ko}
              {analysis.source === "abstract" && " — 저자가 쓴 한계는 전문에 있을 수 있습니다."}
            </p>
            <ReviewButtons pmid={paper.pmid} value={paper.reviewStatus} />
          </div>
          <dl className="mt-6 grid gap-x-6 gap-y-2 text-[15.5px] sm:grid-cols-[130px_minmax(0,1fr)]">
            <dt className="text-ink/65">Subject · 대상</dt>
            <dd>{SUBJECT_LABEL[analysis.subject.kind].ko} — {analysis.subject.detail}{analysis.subject.n ? ` (n=${analysis.subject.n})` : ""}</dd>
            <dt className="text-ink/65">Material · 재료</dt>
            <dd>{analysis.material}</dd>
            <dt className="text-ink/65">Follow-up · 추적</dt>
            <dd>{analysis.followUp ?? "명시 없음"}</dd>
          </dl>
          <Section en="Findings" ko="핵심 결과" items={analysis.findings} />
          {analysis.limitations.length > 0 && (
            <section className="mt-7">
              <h2 className="text-[14.5px] font-semibold text-ink/70">Limitations · 한계</h2>
              <ul className="mt-2 space-y-3 text-[16px] leading-relaxed">
                {analysis.limitations.map((item) => (
                  <li key={item.text}>
                    {item.text}
                    {item.quote && (
                      <blockquote className="mt-1 border-l-2 border-ink/20 pl-3 text-[14.5px] text-ink/75">
                        <span lang="en">“{item.quote}”</span>
                        {!item.quoteVerified && <span className="ml-2 font-semibold text-[#8a5a00]">인용 확인 안 됨</span>}
                      </blockquote>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <Section en="Can claim" ko="말할 수 있는 것" items={analysis.canClaim} />
          <Section en="Cannot claim" ko="말할 수 없는 것" items={analysis.cannotClaim} />
          <Section en="For procedures" ko="시술 시사점" items={analysis.implications.filter((i) => i.kind === "procedure").map((i) => i.text)} />
          <Section en="For consults" ko="상담 시사점" items={analysis.implications.filter((i) => i.kind === "consult").map((i) => i.text)} />
        </>
      ) : (
        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-[6px] bg-mist p-3 text-[14.5px]">
          <span>{statusText(paper.status)}</span>
          {paper.error && <span role="alert" className="text-red-800">{paper.error}</span>}
          {paper.status !== "analyzing" && <AnalyzeButton pmid={paper.pmid} retry={paper.status === "failed"} />}
          <ReviewButtons pmid={paper.pmid} value={paper.reviewStatus} />
        </div>
      )}

      <section className="mt-8 border-t border-ink/10 pt-5">
        <h2 className="text-[14.5px] font-semibold text-ink/70">Abstract · 초록</h2>
        <p lang="en" className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-ink/85">{paper.abstract}</p>
      </section>
    </article>
  );
}
