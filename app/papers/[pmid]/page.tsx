// app/papers/[pmid]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { Fragment, type ReactNode } from "react";
import { AnalyzeButton } from "../../../components/papers/AnalyzeButton";
import { ReviewButtons } from "../../../components/papers/ReviewButtons";
import { TopicTag } from "../../../components/papers/TopicTag";
import { authorsShort, LEVEL_LABEL, pubmedUrl } from "../../../lib/bbip/literature/refs";
import { ifText, SOURCE_LABEL, statusText, SUBJECT_LABEL } from "../../../lib/papers/labels";
import { emphasize, splitSentences } from "../../../lib/papers/note";
import { getPaper } from "../../../lib/services/paperService";

export const dynamic = "force-dynamic";

const LIST = "mt-3 space-y-3 text-[16.5px] leading-[1.8] text-ink/90";

/** Lead-ins and measures stand out; the words stay exactly as analyzed. */
function NoteText({ text }: { text: string }) {
  return (
    <>
      {emphasize(text).map((part, i) =>
        part.strong ? (
          <strong key={i} className="font-semibold text-inkdeep">{part.text}</strong>
        ) : (
          <Fragment key={i}>{part.text}</Fragment>
        )
      )}
    </>
  );
}

function NoteSection({ en, ko, marked, children }: { en: string; ko: string; marked?: boolean; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-serifa text-[1.3rem] font-bold leading-snug text-inkdeep">
        <span className={marked ? "hl-yellow rounded-[2px] px-1" : undefined}>{en} · {ko}</span>
      </h2>
      {children}
    </section>
  );
}

function Bullets({ en, ko, items, marked }: { en: string; ko: string; items: string[]; marked?: boolean }) {
  if (items.length === 0) return null;
  return (
    <NoteSection en={en} ko={ko} marked={marked}>
      <ul className={`${LIST} list-disc pl-5 marker:text-ink/35`}>
        {items.map((item) => <li key={item}><NoteText text={item} /></li>)}
      </ul>
    </NoteSection>
  );
}

function Claims({ en, ko, items, mark, color }: { en: string; ko: string; items: string[]; mark: string; color: string }) {
  if (items.length === 0) return null;
  return (
    <NoteSection en={en} ko={ko}>
      <ul className={LIST}>
        {items.map((item) => (
          <li key={item} className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-1">
            <span aria-hidden="true" className="font-semibold" style={{ color }}>{mark}</span>
            <span><NoteText text={item} /></span>
          </li>
        ))}
      </ul>
    </NoteSection>
  );
}

/** One sentence per line: the first carries the point, the rest step back. */
function Glance({ label, lead, text }: { label: string; lead?: string; text: string }) {
  const [first, ...rest] = splitSentences(text);
  return (
    <div className="grid gap-x-5 gap-y-1 sm:grid-cols-[108px_minmax(0,1fr)]">
      <dt className="pt-0.5 text-[13.5px] text-ink/65">{label}</dt>
      <dd className="text-[15.5px] leading-[1.75] text-ink">
        {lead && <strong className="mr-1.5 font-semibold text-inkdeep">{lead}</strong>}
        {first && <NoteText text={first} />}
        {rest.map((sentence) => (
          <span key={sentence} className="mt-1 block text-ink/70"><NoteText text={sentence} /></span>
        ))}
      </dd>
    </div>
  );
}

export default async function PaperPage({ params }: { params: Promise<{ pmid: string }> }) {
  const { pmid } = await params;
  const paper = getPaper(pmid);
  if (!paper) notFound();
  const { analysis } = paper;
  return (
    <article className="mx-auto max-w-[720px] break-words break-keep">
      <Link href="/papers" className="text-[14px] text-ink/60 hover:text-ink">← Papers · 논문</Link>

      <header className="mt-6">
        <div className="flex flex-wrap items-center gap-2">
          {paper.topics.map((topic) => <TopicTag key={topic} topic={topic} />)}
        </div>
        <h1 className="mt-3 font-serifa text-[1.9rem] font-bold leading-[1.3] tracking-tight text-inkdeep">{paper.title}</h1>
        <p className="mt-3 text-[14.5px] leading-relaxed text-ink/70">
          {[authorsShort(paper.authors), paper.journalName ?? paper.journalTa, paper.year, LEVEL_LABEL[paper.level], ifText(paper.impactFactor).replaceAll(" ", "\u00a0")].filter(Boolean).join(" · ")}
          <a href={pubmedUrl(paper.pmid)} target="_blank" rel="noopener noreferrer" className="ml-3 underline underline-offset-4">PubMed</a>
          {paper.doi && <a href={`https://doi.org/${encodeURI(paper.doi)}`} target="_blank" rel="noopener noreferrer" className="ml-3 underline underline-offset-4">DOI</a>}
        </p>
      </header>

      {analysis ? (
        <>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-y border-ink/10 py-2.5">
            <p className="text-[14px] text-ink/70">
              AI 분석 · {SOURCE_LABEL[analysis.source].ko}
              {analysis.source === "abstract" && " — 저자가 쓴 한계는 전문에 있을 수 있습니다."}
            </p>
            <ReviewButtons pmid={paper.pmid} value={paper.reviewStatus} />
          </div>

          <section aria-labelledby="paper-glance" className="mt-6 rounded-xl bg-mist/70 px-5 py-4">
            <h2 id="paper-glance" className="text-[14px] font-semibold text-inkdeep">At a glance · 한눈에 보기</h2>
            <dl className="mt-3 space-y-3">
              <Glance
                label="Subject · 대상"
                lead={`${SUBJECT_LABEL[analysis.subject.kind].ko}${analysis.subject.n ? ` n=${analysis.subject.n}` : ""}`}
                text={analysis.subject.detail}
              />
              <Glance label="Material · 재료" text={analysis.material} />
              <Glance label="Follow-up · 추적" text={analysis.followUp ?? "명시 없음"} />
            </dl>
          </section>

          <Bullets en="Findings" ko="핵심 결과" items={analysis.findings} />

          {analysis.limitations.length > 0 && (
            <NoteSection en="Limitations" ko="한계">
              <ul className={`${LIST} list-disc pl-5 marker:text-ink/35`}>
                {analysis.limitations.map((item) => (
                  <li key={item.text}>
                    <NoteText text={item.text} />
                    {item.quote && (
                      <blockquote className="mb-1 mt-2 border-l-2 border-ink/20 pl-3 text-[14.5px] leading-relaxed text-ink/70">
                        <span lang="en">“{item.quote}”</span>
                        {!item.quoteVerified && <span className="ml-2 font-semibold text-[#8a5a00]">인용 확인 안 됨</span>}
                      </blockquote>
                    )}
                  </li>
                ))}
              </ul>
            </NoteSection>
          )}

          <Claims en="Can claim" ko="말할 수 있는 것" items={analysis.canClaim} mark="✓" color="#0f5132" />
          <Claims en="Cannot claim" ko="말할 수 없는 것" items={analysis.cannotClaim} mark="✕" color="#9b1c1c" />
          <Bullets marked en="For procedures" ko="시술 시사점" items={analysis.implications.filter((i) => i.kind === "procedure").map((i) => i.text)} />
          <Bullets marked en="For consults" ko="상담 시사점" items={analysis.implications.filter((i) => i.kind === "consult").map((i) => i.text)} />
        </>
      ) : (
        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl bg-mist/70 px-5 py-4 text-[14.5px]">
          <span>{statusText(paper.status)}</span>
          {paper.error && <span role="alert" className="text-red-800">{paper.error}</span>}
          {paper.status !== "analyzing" && <AnalyzeButton pmid={paper.pmid} retry={paper.status === "failed"} />}
          <ReviewButtons pmid={paper.pmid} value={paper.reviewStatus} />
        </div>
      )}

      {paper.abstract && (
        <details open={!analysis} className="mt-10 border-t border-ink/10 pt-5">
          <summary className="cursor-pointer text-[15px] font-semibold text-ink/70 hover:text-ink">Abstract · 초록</summary>
          <p lang="en" className="mt-3 whitespace-pre-line text-[15px] leading-[1.75] text-ink/85">{paper.abstract}</p>
        </details>
      )}
    </article>
  );
}
