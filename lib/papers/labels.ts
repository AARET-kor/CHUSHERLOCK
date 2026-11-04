// lib/papers/labels.ts
// Display text shared by the list and the detail page. Pure.
import type { PaperAnalysis, PaperStatus, ReviewStatus, SubjectKind } from "./types";

export const SUBJECT_LABEL: Record<SubjectKind, { en: string; ko: string }> = {
  human: { en: "Human", ko: "사람" },
  animal: { en: "Animal", ko: "동물" },
  in_vitro: { en: "In vitro", ko: "세포" },
  review: { en: "Review", ko: "리뷰" },
  unclear: { en: "Unclear", ko: "불명확" },
};

export const REVIEW_LABEL: Record<ReviewStatus, { en: string; ko: string }> = {
  unreviewed: { en: "Unreviewed", ko: "미검토" },
  reviewed: { en: "Reviewed", ko: "검토함" },
  excluded: { en: "Excluded", ko: "제외" },
};

export const SOURCE_LABEL: Record<PaperAnalysis["source"], { en: string; ko: string }> = {
  fulltext: { en: "Full text", ko: "전문 분석" },
  abstract: { en: "Abstract only", ko: "초록만 분석" },
};

export function statusText(status: PaperStatus): string {
  if (status === "analyzing") return "Analyzing · 분석 중";
  if (status === "failed") return "Failed · 분석 실패";
  if (status === "pending") return "Not analyzed · 미분석";
  return "Analyzed · 분석됨";
}

export const ifText = (value: number | null) => (value === null ? "IF —" : `IF ≈ ${value.toFixed(1)}`);
