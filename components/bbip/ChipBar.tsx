"use client";

import { useState } from "react";
import { T, type BiTerm } from "../../lib/bbip/terms";
import type { ParsedCase } from "../../lib/bbip/types";
import { Term } from "./Term";

/** Mirrors the per-group cap in createSessionSchema. */
const MAX_PER_GROUP = 8;

export const CHIP_GROUPS: Array<{ key: keyof ParsedCase; label: string; term: BiTerm }> = [
  { key: "patient", label: "환자", term: T.patient },
  { key: "conditions", label: "질환·고민", term: T.conditions },
  { key: "meds", label: "복용약", term: T.meds },
  { key: "procedures", label: "시술", term: T.procedures },
];

/** The parsed case as a chart header: four labelled columns of plain words.
 * Removing or adding a word opens a new session (the brief is rewritten). */
export function ChipBar({
  chips,
  disabled,
  onChange,
}: {
  chips: ParsedCase;
  disabled: boolean;
  onChange: (chips: ParsedCase) => void;
}) {
  const [group, setGroup] = useState<keyof ParsedCase | null>(null);
  const [draft, setDraft] = useState("");
  const total = CHIP_GROUPS.reduce((sum, g) => sum + chips[g.key].length, 0);
  const groupFull = group !== null && chips[group].length >= MAX_PER_GROUP;
  const firstOpen = CHIP_GROUPS.find((g) => chips[g.key].length < MAX_PER_GROUP)?.key ?? null;

  function remove(key: keyof ParsedCase, index: number) {
    onChange({ ...chips, [key]: chips[key].filter((_, i) => i !== index) });
  }

  function cancel() {
    setDraft("");
    setGroup(null);
  }

  function add() {
    const value = draft.trim();
    if (!group || !value || disabled || groupFull) return;
    onChange({ ...chips, [group]: [...chips[group], value] });
    cancel();
  }

  return (
    <div>
      <dl className="grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
        {CHIP_GROUPS.map((g) => (
          <div key={g.key} className="min-w-0">
            <dt className="mb-2 text-[13.5px] font-semibold text-ink/70"><Term term={g.term} /></dt>
            <dd className="flex flex-col items-start gap-1">
              {chips[g.key].length === 0 && <span className="text-[17px] text-ink/25">—</span>}
              {chips[g.key].map((item, index) => (
                <span key={`${g.key}-${index}`} className="group inline-flex max-w-full items-baseline gap-1.5">
                  <span className="break-words text-[17px] leading-snug text-ink">{item}</span>
                  <button
                    type="button"
                    aria-label={`${item} 삭제`}
                    disabled={disabled || total <= 1}
                    onClick={() => remove(g.key, index)}
                    className="text-[15px] leading-none text-ink/25 transition hover:text-red-700 focus-visible:text-red-700 disabled:opacity-0"
                  >
                    ×
                  </button>
                </span>
              ))}
            </dd>
          </div>
        ))}
      </dl>

      {group ? (
        <form
          className="mt-5 flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") cancel();
          }}
        >
          <label htmlFor="chip-group" className="sr-only">
            칩 종류
          </label>
          <select
            id="chip-group"
            value={group}
            onChange={(e) => setGroup(e.target.value as keyof ParsedCase)}
            className="bbip-line !w-auto pb-1.5 text-[15px] text-ink"
          >
            {CHIP_GROUPS.map((g) => (
              <option key={g.key} value={g.key}>
                {g.term.en} · {g.label}
              </option>
            ))}
          </select>
          <label htmlFor="chip-draft" className="sr-only">
            칩 내용
          </label>
          <input
            id="chip-draft"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // Enter confirming an IME composition must not submit the form.
              if (e.key === "Enter" && (e.nativeEvent.isComposing || e.keyCode === 229)) e.preventDefault();
            }}
            maxLength={40}
            autoFocus
            placeholder="추가할 항목"
            className="bbip-line !w-48 pb-1.5 text-[16px] text-ink"
          />
          <button
            type="submit"
            disabled={disabled || groupFull || !draft.trim()}
            className="pb-1.5 text-[15px] font-semibold text-ink underline decoration-ink/30 underline-offset-4 hover:decoration-ink disabled:text-ink/30 disabled:no-underline"
          >
            추가
          </button>
          <button type="button" onClick={cancel} className="pb-1.5 text-[15px] text-ink/65 hover:text-ink">
            취소
          </button>
          {groupFull && (
            <span role="status" className="pb-1.5 text-[14px] text-amber-800">
              칩은 그룹당 최대 {MAX_PER_GROUP}개입니다.
            </span>
          )}
        </form>
      ) : (
        <button
          type="button"
          disabled={disabled || firstOpen === null}
          onClick={() => setGroup(chips.conditions.length < MAX_PER_GROUP ? "conditions" : firstOpen)}
          className="mt-5 text-[14.5px] text-ink/60 underline decoration-ink/20 underline-offset-4 transition hover:text-ink hover:decoration-ink disabled:opacity-40"
        >
          + 칩 추가
        </button>
      )}
    </div>
  );
}
