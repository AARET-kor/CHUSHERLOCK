"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";
import type { ParsedCase } from "../../lib/bbip/types";
import { CHIP_ICONS } from "./icons";

const GROUPS: Array<{ key: keyof ParsedCase; label: string }> = [
  { key: "patient", label: "환자" },
  { key: "conditions", label: "질환·고민" },
  { key: "meds", label: "복용약" },
  { key: "procedures", label: "시술" },
];

/** Parsed case chips, rendered inside the dark hero. Editing chips opens a
 * new session (the brief is regenerated). */
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
  const total = GROUPS.reduce((sum, g) => sum + chips[g.key].length, 0);

  function remove(key: keyof ParsedCase, index: number) {
    onChange({ ...chips, [key]: chips[key].filter((_, i) => i !== index) });
  }

  function cancel() {
    setDraft("");
    setGroup(null);
  }

  function add() {
    const value = draft.trim();
    if (!group || !value || disabled) return;
    onChange({ ...chips, [group]: [...chips[group], value] });
    setDraft("");
    setGroup(null);
  }

  return (
    <div className="mt-5">
      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-white/55">Parsed case</p>
      <div className="flex flex-wrap items-center gap-2">
        {GROUPS.flatMap((g) => {
          const Icon = CHIP_ICONS[g.key];
          return chips[g.key].map((item, index) => (
            <span
              key={`${g.key}-${index}`}
              title={g.label}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/10 py-1 pl-3 pr-1 text-xs text-white ring-1 ring-white/15"
            >
              <Icon aria-hidden="true" className="h-3.5 w-3.5 text-[#bfe7d1]" />
              {item}
              <button
                type="button"
                aria-label={`${item} 삭제`}
                disabled={disabled || total <= 1}
                onClick={() => remove(g.key, index)}
                className="flex h-5 w-5 items-center justify-center rounded-full text-white/70 transition hover:bg-white/20 hover:text-white disabled:opacity-30"
              >
                <X aria-hidden="true" className="h-3 w-3" />
              </button>
            </span>
          ));
        })}
        {group ? (
          <form
            className="flex flex-wrap items-center gap-1.5"
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
              className="field !w-auto !rounded-full !py-1 text-xs"
            >
              {GROUPS.map((g) => (
                <option key={g.key} value={g.key}>
                  {g.label}
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
              className="field !w-36 !rounded-full !py-1 text-xs"
            />
            <button
              type="submit"
              className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink transition hover:bg-[#bfe7d1] disabled:opacity-50"
              disabled={disabled || !draft.trim()}
            >
              추가
            </button>
            <button
              type="button"
              onClick={cancel}
              className="rounded-full px-2 py-1 text-xs text-white/70 transition hover:text-white"
            >
              취소
            </button>
          </form>
        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={() => setGroup("conditions")}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-white/30 px-3 py-1 text-xs text-white/70 transition hover:border-white/60 hover:text-white disabled:opacity-40"
          >
            <Plus aria-hidden="true" className="h-3 w-3" />칩 추가
          </button>
        )}
      </div>
    </div>
  );
}
