// lib/bbip/care/fields.ts
import type { CareItem, CareKind, CareSource, Urgency } from "./types";

export interface CareField {
  key: string;
  label: string;
  /** English name, shown above the Korean label. */
  en: string;
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

export const KIND_EN: Record<CareKind, string> = {
  rx: "Prescription",
  dressing: "Dressing & Care",
  contingency: "If This Happens",
  followup: "Follow-up",
};

export const URGENCY_LABEL: Record<Urgency, string> = {
  now: "바로 연락·내원",
  followup: "다음 내원 때",
  watch: "지켜봐도 됨",
};

export const CARE_FIELDS: Record<CareKind, CareField[]> = {
  rx: [
    { key: "drug", label: "성분명", en: "Generic Name", required: true, hint: "예: mupirocin" },
    { key: "brand", label: "상품명 예", en: "Brand (e.g.)", required: false },
    { key: "form", label: "제형·함량", en: "Form & Strength", required: true, hint: "예: 2% 연고, 500 mg 정" },
    { key: "dose", label: "1회량", en: "Dose", required: true, hint: "예: 1정, 얇게 도포" },
    { key: "frequency", label: "횟수", en: "Frequency", required: true, hint: "예: 1일 3회" },
    { key: "duration", label: "기간", en: "Duration", required: true, hint: "예: 5일" },
    { key: "purpose", label: "목적", en: "Purpose", required: false },
  ],
  dressing: [
    { key: "material", label: "재료", en: "Material", required: true },
    { key: "method", label: "방법", en: "Method", required: true },
    { key: "interval", label: "교체 주기", en: "Change Interval", required: false },
    { key: "duration", label: "기간", en: "Duration", required: false },
  ],
  contingency: [
    { key: "situation", label: "상황", en: "Situation", required: true, hint: "예: HSV 재발 의심" },
    { key: "signs", label: "징후", en: "Signs", required: false },
    { key: "action", label: "조치", en: "Action", required: true, hint: "쓸 약·처치" },
    { key: "resolution", label: "경과·해결", en: "Course & Resolution", required: false },
    {
      key: "urgency",
      label: "긴급도",
      en: "Urgency",
      required: true,
      options: (Object.keys(URGENCY_LABEL) as Urgency[]).map((value) => ({ value, label: URGENCY_LABEL[value] })),
    },
  ],
  followup: [
    { key: "day", label: "시술 후 일수", en: "Day after Procedure", required: false, hint: "예: 7" },
    { key: "when", label: "시점", en: "Timing", required: true, hint: "예: D+7" },
    { key: "checks", label: "확인 항목", en: "Checks", required: true },
    { key: "next", label: "다음 계획", en: "Next Plan", required: false },
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

/** Stable key of a kind's field values — what a patient sentence was written for. */
export function fieldsFingerprint(kind: CareKind, fields: Record<string, string>): string {
  return JSON.stringify(CARE_FIELDS[kind].map((field) => (fields[field.key] ?? "").trim()));
}

/** False once the fields moved on from what patientText was written for. */
export function patientTextCurrent(item: CareItem): boolean {
  return item.patientTextBasis === undefined || item.patientTextBasis === fieldsFingerprint(item.kind, item.fields);
}

export function newCareItem(kind: CareKind, source: CareSource = "doctor"): CareItem {
  return { id: crypto.randomUUID(), kind, fields: emptyFields(kind), patientText: "", source, confirmed: false };
}
