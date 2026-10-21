// lib/records/features.ts
import type { ParsedCase } from "../bbip/types";

/** A patient's quick description from consult chips: "40대 여성 · 기미 · 와파린". */
export function featuresFromChips(chips: ParsedCase): string {
  return [...chips.patient, ...chips.conditions.slice(0, 2), ...chips.meds.slice(0, 2)]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" · ")
    .slice(0, 120);
}
