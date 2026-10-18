import type { Flag, FlagLevel, ParsedCase } from "./types";

// Deterministic safety net: these flags fire from a keyword table even when
// the parser model misses them. Texts are deliberately conservative — they
// say what to check, not what to prescribe.

interface FlagRule {
  level: FlagLevel;
  keywords: string[];
  text: string;
}

const RULES: FlagRule[] = [
  {
    level: "contraindication",
    keywords: ["임신", "임산부", "pregnan"],
    text: "임신 — 선택적 미용 시술은 출산 후로 연기 권장 (확인 필요)",
  },
  {
    level: "contraindication",
    keywords: ["이소트레티노인", "isotretinoin", "로아큐탄", "아큐탄", "accutane"],
    text: "이소트레티노인 복용 — 박피·레이저·침습 시술 시기 확인 필요 (흉터·치유 지연 위험)",
  },
  {
    level: "caution",
    keywords: ["수유", "breastfeed", "lactat"],
    text: "수유 중 — 약물·주사 시술 안전성 확인 필요",
  },
  {
    level: "caution",
    keywords: [
      "아스피린", "aspirin", "와파린", "warfarin", "항응고", "항혈소판",
      "클로피도그렐", "clopidogrel", "플라빅스", "리바록사반", "rivaroxaban",
      "아픽사반", "apixaban", "엘리퀴스", "자렐토", "noac",
    ],
    text: "항응고/항혈소판제 — 멍·출혈 위험 ↑, 임의 중단 금지 (처방의와 상의)",
  },
  {
    level: "caution",
    keywords: ["켈로이드", "keloid", "비후성 반흔"],
    text: "켈로이드/비후성 반흔 경향 — 침습 시술 흉터 위험 설명 필요",
  },
  {
    level: "caution",
    keywords: ["자가면역", "루푸스", "lupus", "류마티스", "경피증", "scleroderma"],
    text: "자가면역질환 — 필러·자극형 제제 반응성, 질환 활성도 확인 필요",
  },
  {
    level: "caution",
    keywords: ["헤르페스", "herpes", "hsv", "단순포진", "활동성 감염"],
    text: "HSV/활동성 감염 — 병변 부위 시술 연기, 예방 투약 여부 확인",
  },
  {
    level: "caution",
    keywords: ["필러 부작용", "혈관 폐색", "육아종", "granuloma", "vascular occlusion"],
    text: "과거 필러/시술 부작용 병력 — 기존 제품·부위·경과 확인 필요",
  },
  {
    level: "caution",
    keywords: ["독시사이클린", "doxycycline", "광과민", "photosensit", "트레티노인", "tretinoin"],
    text: "광과민 가능 약물 — 레이저·광 시술 전 복용 확인 필요",
  },
];

// Negations ("임신 아님") intentionally still flag: the texts say "확인 필요",
// and a false alarm is cheaper than a missed one.
// `extraText` (the raw memo) lets the net catch keywords the parser dropped.
export function ruleFlags(chips: ParsedCase, extraText = ""): Flag[] {
  const haystack = [...chips.patient, ...chips.conditions, ...chips.meds, ...chips.procedures, extraText]
    .join(" ")
    .toLowerCase();
  return RULES.filter((rule) => rule.keywords.some((k) => haystack.includes(k.toLowerCase()))).map(
    (rule) => ({ level: rule.level, text: rule.text, source: "rule" as const })
  );
}

/** Rule flags win ties (same text); contraindications sort first. */
export function mergeFlags(rule: Flag[], model: Flag[]): Flag[] {
  const seen = new Set<string>();
  const merged: Flag[] = [];
  for (const flag of [...rule, ...model]) {
    const key = flag.text.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push({ ...flag, text: key });
  }
  const rank = (f: Flag) => (f.level === "contraindication" ? 0 : 1);
  return merged
    .map((flag, index) => ({ flag, index }))
    .sort((a, b) => rank(a.flag) - rank(b.flag) || a.index - b.index)
    .map(({ flag }) => flag);
}
