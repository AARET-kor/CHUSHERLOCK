// lib/bbip/care/lint.ts
import { CARE_FIELDS, patientTextCurrent } from "./fields";
import { interactionsFor } from "./interactions";
import type { CareItem } from "./types";

export interface CareIssue {
  level: "error" | "warn";
  text: string;
}

export const AI_NUMBER_WARNING = "AI 제안 수치 — 확인 필요";
export const STALE_PATIENT_TEXT = "칸이 바뀌어 환자 안내 문장이 안내문에서 빠집니다 — 다시 확인하세요";

const URGENCIES = new Set(["now", "followup", "watch"]);
const ORAL = /정|캡슐|시럽|tab|cap|syrup|oral|경구/i;
const NUMBER_UNIT = /\d\s*(?:mg|mcg|µg|g|ml|cc|iu|단위|정|캡슐|포|%)/i;
const DIGIT = /\d/;

/** Errors block confirmation; warnings are shown and the doctor decides. */
export function itemIssues(item: CareItem, context: string): CareIssue[] {
  const issues: CareIssue[] = [];
  const value = (key: string) => (item.fields[key] ?? "").trim();
  for (const field of CARE_FIELDS[item.kind]) {
    if (field.required && !value(field.key)) issues.push({ level: "error", text: `"${field.label}" 칸을 채우세요` });
  }
  if (item.kind === "contingency" && value("urgency") && !URGENCIES.has(value("urgency"))) {
    issues.push({ level: "error", text: "긴급도는 바로 연락·내원 / 다음 내원 때 / 지켜봐도 됨 중 하나여야 합니다" });
  }
  if (item.kind === "followup" && value("day") && !/^\d{1,3}$/.test(value("day"))) {
    issues.push({ level: "error", text: "시술 후 일수는 숫자만 적으세요" });
  }
  for (const rule of interactionsFor(item, context)) {
    issues.push({ level: "warn", text: `${rule.level === "contraindication" ? "금기" : "주의"} — ${rule.text}` });
  }
  if (item.kind === "rx") {
    if (ORAL.test(value("form")) && !NUMBER_UNIT.test(`${value("form")} ${value("dose")}`)) {
      issues.push({ level: "warn", text: "경구약 — 함량이나 1회량에 숫자와 단위를 적으세요" });
    }
    if (DIGIT.test(item.patientText)) {
      issues.push({ level: "warn", text: "환자 문장에 숫자가 있습니다 — 처방 칸과 다를 수 있습니다" });
    }
  }
  if (item.patientText.trim() && !patientTextCurrent(item)) {
    issues.push({ level: "warn", text: STALE_PATIENT_TEXT });
  }
  if (item.source === "ai" && !item.confirmed && Object.values(item.fields).some((v) => DIGIT.test(v))) {
    issues.push({ level: "warn", text: AI_NUMBER_WARNING });
  }
  return issues;
}

export function canConfirm(item: CareItem, context: string): boolean {
  return !itemIssues(item, context).some((issue) => issue.level === "error");
}

export function activeItems(items: CareItem[]): CareItem[] {
  return items.filter((item) => !item.removed);
}

/** Copy, handout and set saving all require this. */
export function orderReady(items: CareItem[], context: string): boolean {
  const active = activeItems(items);
  return active.length > 0 && active.every((item) => item.confirmed && canConfirm(item, context));
}
