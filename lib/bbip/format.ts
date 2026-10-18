import type { ParsedCase } from "./types";

export function chipSummary(chips: ParsedCase): string {
  return [...chips.procedures, ...chips.conditions, ...chips.patient, ...chips.meds]
    .slice(0, 4)
    .join(" · ");
}

export function formatSessionTime(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
