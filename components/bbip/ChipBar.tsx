"use client";

import { useState } from "react";
import type { ParsedCase } from "../../lib/bbip/types";

const GROUPS: Array<{ key: keyof ParsedCase; emoji: string; label: string }> = [
  { key: "patient", emoji: "👤", label: "환자" },
  { key: "conditions", emoji: "🩺", label: "질환·고민" },
  { key: "meds", emoji: "💊", label: "복용약" },
  { key: "procedures", emoji: "💉", label: "시술" },
];

/** Editing chips opens a new session (the brief is regenerated). */
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

  function add() {
    const value = draft.trim();
    if (!group || !value) return;
    onChange({ ...chips, [group]: [...chips[group], value] });
    setDraft("");
    setGroup(null);
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      {GROUPS.flatMap((g) =>
        chips[g.key].map((item, index) => (
          <span
            key={`${g.key}-${item}`}
            className="inline-flex items-center gap-1 rounded-full border border-ink/15 bg-white py-1 pl-3 pr-1 text-xs text-ink"
          >
            <span aria-hidden="true">{g.emoji}</span>
            {item}
            <button
              type="button"
              aria-label={`${item} 삭제`}
              disabled={disabled || total <= 1}
              onClick={() => remove(g.key, index)}
              className="flex h-5 w-5 items-center justify-center rounded-full text-ink/50 hover:bg-mist hover:text-ink disabled:opacity-30"
            >
              ✕
            </button>
          </span>
        ))
      )}
      {group ? (
        <form
          className="flex items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <label htmlFor="chip-group" className="sr-only">
            칩 종류
          </label>
          <select
            id="chip-group"
            value={group}
            onChange={(e) => setGroup(e.target.value as keyof ParsedCase)}
            className="field !w-auto !py-1 text-xs"
          >
            {GROUPS.map((g) => (
              <option key={g.key} value={g.key}>
                {g.emoji} {g.label}
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
            maxLength={40}
            autoFocus
            className="field !w-36 !py-1 text-xs"
          />
          <button type="submit" className="btn-secondary !px-3 !py-1 text-xs" disabled={!draft.trim()}>
            추가
          </button>
        </form>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setGroup("conditions")}
          className="rounded-full border border-dashed border-ink/25 px-3 py-1 text-xs text-ink/60 hover:border-ink/50 hover:text-ink"
        >
          ＋ 칩 추가
        </button>
      )}
    </div>
  );
}
