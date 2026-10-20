"use client";

import { useState } from "react";
import { SECTIONS, type SectionGroup } from "../../lib/bbip/sections";
import { GROUP_TERMS, T } from "../../lib/bbip/terms";
import type { SectionKey, TurnRequest } from "../../lib/bbip/types";
import { Term } from "./Term";
import { LiteratureIndexItem } from "./LiteratureFootnotes";
import { CareIndexItem } from "./care/CareIndexItem";

const GROUPS: SectionGroup[] = ["safety", "practice", "business"];

/** What to read next, laid out like a table of contents: suggested
 * follow-ups as serif lines, the nine sections as an index, and a direct
 * question on a hairline. */
export function MoreMenu({
  followups,
  openedSections,
  openedQuestions,
  literatureOpened = false,
  careOpened = false,
  onCare,
  onRequest,
}: {
  followups: string[];
  openedSections: Set<SectionKey>;
  openedQuestions: Set<string>;
  literatureOpened?: boolean;
  careOpened?: boolean;
  onCare?: () => void;
  onRequest: (request: TurnRequest) => void;
}) {
  const [question, setQuestion] = useState("");

  return (
    <div>
      {followups.length > 0 && (
        <div className="mb-9">
          <p className="mb-2 text-[13.5px] font-semibold text-ink/70"><Term term={T.suggested} /></p>
          <ul className="border-t border-ink/[0.08]">
            {followups.map((q) => {
              const asked = openedQuestions.has(q);
              return (
                <li key={q}>
                  <button
                    type="button"
                    disabled={asked}
                    onClick={() => onRequest({ kind: "followup", question: q })}
                    className="group flex w-full items-baseline gap-4 border-b border-ink/[0.08] py-3 text-left transition disabled:cursor-default"
                  >
                    <span className="font-serifa text-[19.5px] leading-snug text-inkdeep underline-offset-[5px] group-hover:underline group-disabled:text-ink/35 group-disabled:no-underline">
                      {q}
                    </span>
                    <span aria-hidden="true" className="ml-auto font-mono text-[12.5px] text-ink/30 transition group-hover:translate-x-0.5 group-hover:text-ink">
                      {asked ? T.opened.en : "→"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="grid gap-x-10 gap-y-7 sm:grid-cols-3">
        {GROUPS.map((group) => (
          <div key={group}>
            <p className="mb-1 text-[13.5px] font-semibold text-ink/70"><Term term={GROUP_TERMS[group]} /></p>
            <ul>
              {SECTIONS.filter((s) => s.group === group).map((section) => {
                const opened = openedSections.has(section.key);
                return (
                  <li key={section.key}>
                    <button
                      type="button"
                      disabled={opened}
                      onClick={() => onRequest({ kind: "section", sectionKey: section.key })}
                      className="group flex w-full items-baseline justify-between gap-3 border-b border-ink/[0.08] py-2.5 text-left transition disabled:cursor-default"
                    >
                      <span className="text-[16.5px] text-ink underline-offset-4 group-hover:underline group-disabled:text-ink/35 group-disabled:no-underline">
                        <Term term={{ en: section.en, ko: section.label }} />
                      </span>
                      <span aria-hidden="true" className="font-mono text-[12.5px] text-ink/30 transition group-hover:text-ink">
                        {opened ? T.opened.en : "→"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {/* literature hook */}
      <LiteratureIndexItem opened={literatureOpened} onRequest={onRequest} />
      {/* care orders hook */}
      {onCare && <CareIndexItem opened={careOpened} onOpen={onCare} />}

      <form
        className="mt-9 flex items-end gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          const q = question.trim();
          if (q.length < 2) return;
          onRequest({ kind: "custom", question: q });
          setQuestion("");
        }}
      >
        <label htmlFor="bbip-custom" className="sr-only">
          {T.ask.en} — {T.ask.ko}
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
          placeholder="Ask directly · 직접 묻기 — 예: 아스피린을 끊고 와야 하나요?"
          className="bbip-line pb-2 font-serifa text-[19.5px] text-inkdeep"
        />
        <button
          type="submit"
          disabled={question.trim().length < 2}
          className="shrink-0 whitespace-nowrap pb-2 text-[15px] font-semibold text-ink underline decoration-ink/30 underline-offset-4 hover:decoration-ink disabled:text-ink/30 disabled:no-underline"
        >
          {T.askButton.en} · {T.askButton.ko} →
        </button>
      </form>
    </div>
  );
}
