"use client";

import { useState } from "react";
import { SECTIONS } from "../../lib/bbip/sections";
import type { SectionKey, TurnRequest } from "../../lib/bbip/types";

export function MoreMenu({
  followups,
  openedSections,
  onRequest,
}: {
  followups: string[];
  openedSections: Set<SectionKey>;
  onRequest: (request: TurnRequest) => void;
}) {
  const [question, setQuestion] = useState("");

  return (
    <section aria-labelledby="bbip-more" className="mt-6">
      <h2 id="bbip-more" className="mb-2 font-mono text-[10px] uppercase tracking-widest text-ink/60">
        더 볼까요?
      </h2>

      {followups.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {followups.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => onRequest({ kind: "followup", question: q })}
              className="rounded-full bg-ink px-3 py-1.5 text-xs text-white transition hover:bg-inkdeep"
            >
              🔍 {q}
            </button>
          ))}
        </div>
      )}

      <div className="mb-3 flex flex-wrap gap-2">
        {SECTIONS.map((section) => {
          const opened = openedSections.has(section.key);
          return (
            <button
              key={section.key}
              type="button"
              disabled={opened}
              onClick={() => onRequest({ kind: "section", sectionKey: section.key })}
              className="rounded-full border border-ink/15 bg-white px-3 py-1.5 text-xs text-ink/80 transition hover:border-ink/40 hover:text-ink disabled:opacity-40"
            >
              {section.emoji} {section.label}
              {opened ? " ✓" : ""}
            </button>
          );
        })}
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const q = question.trim();
          if (q.length < 2) return;
          onRequest({ kind: "custom", question: q });
          setQuestion("");
        }}
      >
        <label htmlFor="bbip-custom" className="sr-only">
          직접 물어보기
        </label>
        <input
          id="bbip-custom"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={500}
          placeholder="💬 직접 물어보기…"
          className="field"
        />
        <button type="submit" className="btn-secondary !px-4 !py-2" disabled={question.trim().length < 2}>
          묻기
        </button>
      </form>
    </section>
  );
}
