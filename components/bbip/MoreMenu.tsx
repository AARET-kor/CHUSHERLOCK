"use client";

import { Check, CornerDownRight, MessageCircle, Microscope, Plus } from "lucide-react";
import { useState } from "react";
import { SECTIONS, type SectionGroup } from "../../lib/bbip/sections";
import type { SectionKey, TurnRequest } from "../../lib/bbip/types";
import { GROUP_LABELS, SECTION_ICONS } from "./icons";
import { SectionHeading } from "./SectionHeading";

const GROUP_ORDER: SectionGroup[] = ["safety", "practice", "business"];

export function MoreMenu({
  followups,
  openedSections,
  openedQuestions,
  literatureOpened,
  onRequest,
}: {
  followups: string[];
  openedSections: Set<SectionKey>;
  openedQuestions: Set<string>;
  literatureOpened: boolean;
  onRequest: (request: TurnRequest) => void;
}) {
  const [question, setQuestion] = useState("");

  return (
    <section aria-labelledby="bbip-more" className="mt-12">
      <SectionHeading id="bbip-more" index="02" kicker="Dig deeper">
        더 <span className="italic">파고들기</span>
      </SectionHeading>

      {followups.length > 0 && (
        <div className="mb-5">
          <p className="mb-2 text-[11px] font-medium text-ink/65">이어서 물어볼 만한 질문</p>
          <div className="flex flex-wrap gap-2">
            {followups.map((q) => (
              <button
                key={q}
                type="button"
                disabled={openedQuestions.has(q)}
                onClick={() => onRequest({ kind: "followup", question: q })}
                className="inline-flex max-w-full items-center gap-2 rounded-full bg-ink px-4 py-2 text-left text-xs font-medium text-white shadow-[0_8px_20px_rgba(5,26,36,0.12)] transition hover:-translate-y-0.5 hover:bg-inkdeep disabled:translate-y-0 disabled:opacity-40 disabled:shadow-none"
              >
                <CornerDownRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[#bfe7d1]" />
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        {GROUP_ORDER.map((group) => {
          const label = GROUP_LABELS[group];
          return (
            <div
              key={group}
              role="group"
              aria-label={label.ko}
              className={`rounded-[24px] border border-ink/10 p-3 shadow-[0_16px_45px_rgba(5,26,36,0.05)] ${
                group === "business" ? "bg-[#f4f0e8]" : "bg-white"
              }`}
            >
              <p className="mb-1.5 flex items-center justify-between px-2 pt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/65">
                <span>{label.en}</span>
                <span className="font-sans text-[11px] font-semibold normal-case tracking-normal text-ink">
                  {label.ko}
                </span>
              </p>
              <div className="space-y-0.5">
                {SECTIONS.filter((section) => section.group === group).map((section) => {
                  const opened = openedSections.has(section.key);
                  const Icon = SECTION_ICONS[section.key];
                  return (
                    <button
                      key={section.key}
                      type="button"
                      disabled={opened}
                      onClick={() => onRequest({ kind: "section", sectionKey: section.key })}
                      className="group flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition hover:bg-ink/5 disabled:cursor-default disabled:hover:bg-transparent"
                    >
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition ${
                          opened ? "bg-emerald-600 text-white" : "bg-ink text-white"
                        }`}
                      >
                        {opened ? (
                          <Check aria-hidden="true" className="h-4 w-4" />
                        ) : (
                          <Icon aria-hidden="true" className="h-4 w-4" />
                        )}
                      </span>
                      <span className={`min-w-0 flex-1 text-sm font-medium ${opened ? "text-ink/65" : "text-inkdeep"}`}>
                        {section.label}
                        {opened && <span className="sr-only"> (열림)</span>}
                      </span>
                      {!opened && (
                        <Plus
                          aria-hidden="true"
                          className="h-3.5 w-3.5 shrink-0 text-ink/40 transition group-hover:text-ink"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        disabled={literatureOpened}
        onClick={() => onRequest({ kind: "literature" })}
        className="mt-3 flex w-full items-center gap-3 rounded-[24px] border border-ink/10 bg-white px-4 py-3 text-left shadow-[0_16px_45px_rgba(5,26,36,0.05)] transition hover:-translate-y-0.5 hover:border-ink/25 disabled:translate-y-0 disabled:cursor-default disabled:opacity-60"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-white">
          <Microscope aria-hidden="true" className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-inkdeep">🔬 문헌 근거 찾기</span>
          <span className="block text-[11px] text-ink/65">
            PubMed와 의학 도메인 웹에서 근거를 찾습니다 — 누를 때만 검색
          </span>
        </span>
        {literatureOpened && <span className="text-[11px] font-medium text-emerald-700">열림</span>}
      </button>

      <form
        className="mt-4 flex items-center gap-2 rounded-full border border-ink/10 bg-white py-1.5 pl-4 pr-1.5 shadow-[0_16px_45px_rgba(5,26,36,0.05)] transition focus-within:border-ink/25 focus-within:ring-2 focus-within:ring-ink/10"
        onSubmit={(e) => {
          e.preventDefault();
          const q = question.trim();
          if (q.length < 2) return;
          onRequest({ kind: "custom", question: q });
          setQuestion("");
        }}
      >
        <MessageCircle aria-hidden="true" className="h-4 w-4 shrink-0 text-ink/50" />
        <label htmlFor="bbip-custom" className="sr-only">
          직접 물어보기
        </label>
        <input
          id="bbip-custom"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            // Enter confirming an IME composition must not submit the form.
            if (e.key === "Enter" && (e.nativeEvent.isComposing || e.keyCode === 229)) e.preventDefault();
          }}
          maxLength={500}
          placeholder="직접 물어보기…"
          className="min-w-0 flex-1 bg-transparent py-1.5 text-sm text-ink placeholder:text-ink/45 focus:outline-none"
        />
        <button
          type="submit"
          className="shrink-0 whitespace-nowrap rounded-full bg-ink px-5 py-2 text-sm font-medium text-white transition hover:bg-inkdeep disabled:opacity-40"
          disabled={question.trim().length < 2}
        >
          묻기
        </button>
      </form>
    </section>
  );
}
