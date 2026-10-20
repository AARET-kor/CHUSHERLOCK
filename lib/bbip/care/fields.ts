// lib/bbip/care/fields.ts
import type { CareItem, CareKind, CareSource, Urgency } from "./types";

export interface CareField {
  key: string;
  label: string;
  required: boolean;
  hint?: string;
  options?: Array<{ value: string; label: string }>;
}

export const CARE_KINDS: CareKind[] = ["rx", "dressing", "contingency", "followup"];

export const KIND_LABEL: Record<CareKind, string> = {
  rx: "처방",
  dressing: "드레싱·처치",
  contingency: "이럴 때는",
  followup: "F/U",
};

export const URGENCY_LABEL: Record<Urgency, string> = {
  now: "바로 연락·내원",
  followup: "다음 내원 때",
  watch: "지켜봐도 됨",
};

export const CARE_FIELDS: Record<CareKind, CareField[]> = {
  rx: [
    { key: "drug", label: "성분명", required: true, hint: "예: mupirocin" },
    { key: "brand", label: "상품명 예", required: false },
    { key: "form", label: "제형·함량", required: true, hint: "예: 2% 연고, 500 mg 정" },
    { key: "dose", label: "1회량", required: true, hint: "예: 1정, 얇게 도포" },
    { key: "frequency", label: "횟수", required: true, hint: "예: 1일 3회" },
    { key: "duration", label: "기간", required: true, hint: "예: 5일" },
    { key: "purpose", label: "목적", required: false },
  ],
  dressing: [
    { key: "material", label: "재료", required: true },
    { key: "method", label: "방법", required: true },
    { key: "interval", label: "교체 주기", required: false },
    { key: "duration", label: "기간", required: false },
  ],
  contingency: [
    { key: "situation", label: "상황", required: true, hint: "예: HSV 재발 의심" },
    { key: "signs", label: "징후", required: false },
    { key: "action", label: "조치", required: true, hint: "쓸 약·처치" },
    { key: "resolution", label: "경과·해결", required: false },
    {
      key: "urgency",
      label: "긴급도",
      required: true,
      options: (Object.keys(URGENCY_LABEL) as Urgency[]).map((value) => ({ value, label: URGENCY_LABEL[value] })),
    },
  ],
  followup: [
    { key: "day", label: "시술 후 일수", required: false, hint: "예: 7" },
    { key: "when", label: "시점", required: true, hint: "예: D+7" },
    { key: "checks", label: "확인 항목", required: true },
    { key: "next", label: "다음 계획", required: false },
  ],
};

/** The field that names a row (dedupe key, checkbox label). */
export const PRIMARY_FIELD: Record<CareKind, string> = {
  rx: "drug",
  dressing: "material",
  contingency: "situation",
  followup: "when",
};

/** Every field key any kind uses — the flat row of the model's JSON schema. */
export const ALL_FIELD_KEYS: string[] = Array.from(
  new Set(CARE_KINDS.flatMap((kind) => CARE_FIELDS[kind].map((field) => field.key)))
);

export function emptyFields(kind: CareKind): Record<string, string> {
  return Object.fromEntries(CARE_FIELDS[kind].map((field) => [field.key, ""]));
}

/** Keeps only the kind's own fields, as trimmed, bounded strings. */
export function pickFields(kind: CareKind, source: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    CARE_FIELDS[kind].map((field) => {
      const value = source[field.key];
      return [field.key, typeof value === "string" ? value.trim().slice(0, 300) : ""];
    })
  );
}

export function newCareItem(kind: CareKind, source: CareSource = "doctor"): CareItem {
  return { id: crypto.randomUUID(), kind, fields: emptyFields(kind), patientText: "", source, confirmed: false };
}
