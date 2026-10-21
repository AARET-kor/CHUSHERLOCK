// components/records/VisitForm.tsx
"use client";

import { useState } from "react";
import { GAIS_LABEL, SCORE_KINDS, VISIT_KIND_LABEL, type ScoreKind, type Visit, type VisitKind } from "../../lib/records/types";

export type VisitDraft = Pick<
  Visit,
  "date" | "kind" | "sessionNo" | "product" | "params" | "note" | "gaisDoctor" | "gaisPatient" | "score" | "nextFuDate"
>;

export const emptyVisitDraft = (date: string): VisitDraft => ({
  date, kind: "session", sessionNo: null, product: "", params: "", note: "", gaisDoctor: null, gaisPatient: null, score: null, nextFuDate: null,
});

const FIELD = "mt-1 block w-full border-b border-ink/20 bg-transparent py-1 text-[15px] text-ink";
const LABEL = "block text-[13px] text-ink/70";
const num = (v: string) => (v.trim() === "" ? null : Number(v));

/** One visit's fields. Used by the course page and the consult record dialog. */
export function VisitForm({
  initial,
  scoreKind,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: VisitDraft;
  scoreKind: ScoreKind;
  submitLabel: string;
  onSubmit: (draft: VisitDraft) => Promise<string | null>;
  onCancel?: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof VisitDraft>(key: K, value: VisitDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const score = SCORE_KINDS[scoreKind];

  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        setError(await onSubmit(draft));
        setSaving(false);
      }}
    >
      <label className={LABEL}>
        Date · 날짜
        <input type="date" required value={draft.date} onChange={(e) => set("date", e.target.value)} className={FIELD} />
      </label>
      <label className={LABEL}>
        Type · 종류
        <select value={draft.kind} onChange={(e) => set("kind", e.target.value as VisitKind)} className={FIELD}>
          {(Object.keys(VISIT_KIND_LABEL) as VisitKind[]).map((k) => (
            <option key={k} value={k}>
              {VISIT_KIND_LABEL[k].en} · {VISIT_KIND_LABEL[k].ko}
            </option>
          ))}
        </select>
      </label>
      {draft.kind === "session" && (
        <label className={LABEL}>
          Session · 회차
          <input type="number" min={0} max={500} value={draft.sessionNo ?? ""} onChange={(e) => set("sessionNo", num(e.target.value))} className={FIELD} />
        </label>
      )}
      <label className={LABEL}>
        Product · 제품
        <input value={draft.product} maxLength={120} onChange={(e) => set("product", e.target.value)} className={FIELD} />
      </label>
      <label className={`${LABEL} sm:col-span-2`}>
        Parameters · 파라미터
        <input value={draft.params} maxLength={200} placeholder="예: 1064nm 3.0J/cm² 8mm" onChange={(e) => set("params", e.target.value)} className={FIELD} />
      </label>
      {(["gaisDoctor", "gaisPatient"] as const).map((key) => (
        <label key={key} className={LABEL}>
          {key === "gaisDoctor" ? "GAIS · 원장" : "GAIS · 환자"}
          <select value={draft[key] ?? ""} onChange={(e) => set(key, num(e.target.value))} className={FIELD}>
            <option value="">—</option>
            {([1, 2, 3, 4, 5] as const).map((g) => (
              <option key={g} value={g}>
                {g} {GAIS_LABEL[g].en} · {GAIS_LABEL[g].ko}
              </option>
            ))}
          </select>
        </label>
      ))}
      {scoreKind !== "none" && (
        <label className={LABEL}>
          {score.en} · {score.ko} ({score.min}–{score.max})
          <input type="number" min={score.min} max={score.max} value={draft.score ?? ""} onChange={(e) => set("score", num(e.target.value))} className={FIELD} />
        </label>
      )}
      <label className={LABEL}>
        Next F/U · 다음 F/U
        <input type="date" value={draft.nextFuDate ?? ""} onChange={(e) => set("nextFuDate", e.target.value || null)} className={FIELD} />
      </label>
      <label className={`${LABEL} sm:col-span-2`}>
        Note · 메모 (이름·연락처는 쓰지 마세요)
        <textarea rows={2} maxLength={2000} value={draft.note} onChange={(e) => set("note", e.target.value)} className="mt-1 block w-full border border-ink/15 bg-transparent p-2 text-[15px] text-ink" />
      </label>
      {error && (
        <p role="alert" className="text-[14px] text-red-800 sm:col-span-2">
          {error}
        </p>
      )}
      <div className="flex gap-5 text-[15px] sm:col-span-2">
        <button type="submit" disabled={saving} className="font-semibold text-ink underline decoration-ink/30 underline-offset-4 hover:decoration-ink disabled:text-ink/40">
          {saving ? "저장 중…" : submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-ink/70 underline decoration-ink/20 underline-offset-4">
            Cancel · 취소
          </button>
        )}
      </div>
    </form>
  );
}
