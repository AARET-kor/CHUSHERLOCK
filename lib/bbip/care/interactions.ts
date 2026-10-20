// lib/bbip/care/interactions.ts
import type { Flag, ParsedCase } from "../types";
import type { CareItem } from "./types";

// Deterministic drug-vs-case checks: a safety net under the model, the same
// way lib/bbip/flags.ts backs the parser. Curated draft — 원장 검토 전.
// Fill INTERACTION_REVIEW when the table has been reviewed.

export interface InteractionRule {
  id: string;
  /** Tested against the case text (chips + flag texts). */
  when: RegExp;
  /** Tested against the row's drug text (rx: drug/brand/form; contingency: action). */
  drug: RegExp;
  level: "contraindication" | "caution";
  text: string;
}

export const INTERACTION_REVIEW: { reviewedBy?: string; reviewedAt?: string } = {};

const PREGNANT = /임신|수유|pregnan|lactat|breast-?feed/i;
const ANTICOAGULANT =
  /아스피린|와파린|항응고|항혈소판|클로피도그렐|아픽사반|리바록사반|에독사반|aspirin|warfarin|clopidogrel|apixaban|rivaroxaban|edoxaban/i;
const PENICILLIN_ALLERGY = /페니실린\s*알레르기|penicillin\s*allerg/i;
const TETRACYCLINES = /독시사이클린|미노사이클린|테트라사이클린|doxycycline|minocycline|tetracycline/i;
const RETINOIDS = /이소트레티노인|트레티노인|아다팔렌|로아큐탄|isotretinoin|tretinoin|adapalene/i;
const NSAIDS =
  /이부프로펜|덱시부프로펜|나프록센|록소프로펜|아세클로페낙|디클로페낙|셀레콕시브|ibuprofen|naproxen|loxoprofen|aceclofenac|diclofenac|celecoxib|nsaid/i;

export const INTERACTION_RULES: InteractionRule[] = [
  { id: "pregnancy-tetracycline", when: PREGNANT, drug: TETRACYCLINES, level: "contraindication", text: "임신·수유 중 테트라사이클린계 금기" },
  { id: "pregnancy-retinoid", when: PREGNANT, drug: RETINOIDS, level: "contraindication", text: "임신·수유 중 레티노이드 금기" },
  {
    id: "anticoagulant-nsaid",
    when: ANTICOAGULANT,
    drug: NSAIDS,
    level: "caution",
    text: "항응고·항혈소판제 복용 — NSAID는 출혈 위험 ↑ (아세트아미노펜 고려)",
  },
  {
    id: "warfarin-antimicrobial",
    when: /와파린|warfarin/i,
    drug: /메트로니다졸|플루코나졸|시프로플록사신|레보플록사신|목시플록사신|클래리스로마이신|에리스로마이신|metronidazole|fluconazole|ciprofloxacin|levofloxacin|moxifloxacin|clarithromycin|erythromycin/i,
    level: "caution",
    text: "와파린 — INR 상승 가능 약물",
  },
  {
    id: "isotretinoin-tetracycline",
    when: /이소트레티노인|로아큐탄|isotretinoin/i,
    drug: TETRACYCLINES,
    level: "contraindication",
    text: "이소트레티노인 + 테트라사이클린계 — 두개내압 상승 위험",
  },
  {
    id: "penicillin-allergy",
    when: PENICILLIN_ALLERGY,
    drug: /페니실린|아목시실린|암피실린|오구멘틴|penicillin|amoxicillin|ampicillin|augmentin/i,
    level: "contraindication",
    text: "페니실린 알레르기 — 페니실린계 금기",
  },
  {
    id: "penicillin-allergy-cephalosporin",
    when: PENICILLIN_ALLERGY,
    drug: /세팔|세프|cephal|cef/i,
    level: "caution",
    text: "페니실린 알레르기 — 세팔로스포린 교차반응 주의",
  },
];

export function caseText(chips: ParsedCase, flags: Flag[]): string {
  return [...chips.patient, ...chips.conditions, ...chips.meds, ...chips.procedures, ...flags.map((f) => f.text)].join(" ");
}

function drugText(item: CareItem): string {
  if (item.kind === "rx") return [item.fields.drug, item.fields.brand, item.fields.form].join(" ");
  if (item.kind === "contingency") return item.fields.action ?? "";
  return "";
}

export function interactionsFor(item: CareItem, context: string): InteractionRule[] {
  const drug = drugText(item);
  if (!drug.trim() || !context.trim()) return [];
  return INTERACTION_RULES.filter((rule) => rule.when.test(context) && rule.drug.test(drug));
}
