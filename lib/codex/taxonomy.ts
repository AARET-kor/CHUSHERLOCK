import type { CategoryDef } from "./types";

// Seed taxonomy derived from the "시술·진료 측면" study checklist in the
// product brief. This is a starting point, not a closed list — new leaf
// categories can be added under an existing parent as material comes in.
export const CATEGORY_TAXONOMY: CategoryDef[] = [
  // 1. Procedure technique
  {
    key: "procedure-technique",
    labelKo: "시술 술기",
    labelEn: "Procedure Technique",
    descriptionKo: "각 시술의 기본 원리와 술기.",
    descriptionEn: "Core principles and technique for each procedure.",
  },
  { key: "botox", labelKo: "보톡스", labelEn: "Botulinum Toxin", parentKey: "procedure-technique" },
  { key: "filler", labelKo: "필러", labelEn: "Dermal Filler", parentKey: "procedure-technique" },
  { key: "skin-booster", labelKo: "스킨부스터", labelEn: "Skin Booster", parentKey: "procedure-technique" },
  { key: "rejuran", labelKo: "리쥬란", labelEn: "Rejuran", parentKey: "skin-booster" },
  { key: "juvelook", labelKo: "쥬베룩", labelEn: "Juvelook", parentKey: "skin-booster" },
  { key: "laser-toning", labelKo: "레이저 토닝", labelEn: "Laser Toning", parentKey: "procedure-technique" },
  { key: "ipl", labelKo: "IPL", labelEn: "IPL", parentKey: "procedure-technique" },
  { key: "pico-laser", labelKo: "피코", labelEn: "Pico Laser", parentKey: "procedure-technique" },
  { key: "co2-laser", labelKo: "CO2", labelEn: "CO2 Laser", parentKey: "procedure-technique" },
  { key: "hifu", labelKo: "HIFU", labelEn: "HIFU", parentKey: "procedure-technique" },
  { key: "rf", labelKo: "RF", labelEn: "Radiofrequency", parentKey: "procedure-technique" },

  // 2. Complications
  {
    key: "complications",
    labelKo: "합병증 대응",
    labelEn: "Complication Management",
    descriptionKo: "미용 시술에서 가장 치명적인 영역. 대응 프로토콜을 정리.",
    descriptionEn: "The highest-stakes area in aesthetics — response protocols.",
  },
  { key: "vascular-occlusion", labelKo: "혈관 폐색", labelEn: "Vascular Occlusion", parentKey: "complications" },
  { key: "skin-necrosis", labelKo: "피부 괴사", labelEn: "Skin Necrosis", parentKey: "complications" },
  { key: "infection", labelKo: "감염", labelEn: "Infection", parentKey: "complications" },
  { key: "granuloma", labelKo: "육아종", labelEn: "Granuloma", parentKey: "complications" },
  { key: "hsv-reactivation", labelKo: "헤르페스 재활성화", labelEn: "HSV Reactivation", parentKey: "complications" },
  { key: "pih", labelKo: "염증후 색소침착", labelEn: "Post-Inflammatory Hyperpigmentation (PIH)", parentKey: "complications" },
  { key: "burn", labelKo: "화상", labelEn: "Burn", parentKey: "complications" },

  // 3. Anatomy
  {
    key: "anatomy",
    labelKo: "해부학",
    labelEn: "Anatomy",
    descriptionKo: "안전한 시술을 위한 얼굴 해부학.",
    descriptionEn: "Facial anatomy required for safe injection/energy-based procedures.",
  },
  { key: "facial-artery", labelKo: "안면동맥", labelEn: "Facial Artery", parentKey: "anatomy" },
  { key: "angular-artery", labelKo: "각동맥", labelEn: "Angular Artery", parentKey: "anatomy" },
  {
    key: "supratrochlear-supraorbital-artery",
    labelKo: "활차상/안와상동맥",
    labelEn: "Supratrochlear / Supraorbital Artery",
    parentKey: "anatomy",
  },
  { key: "infraorbital-foramen", labelKo: "안와하공", labelEn: "Infraorbital Foramen", parentKey: "anatomy" },
  { key: "temporal-danger-zone", labelKo: "측두부 위험 구역", labelEn: "Temporal Danger Zone", parentKey: "anatomy" },

  // 4. Dermatology basics
  {
    key: "dermatology-basics",
    labelKo: "피부과 기본",
    labelEn: "Dermatology Basics",
    descriptionKo: "미용 시술 전반의 기초가 되는 피부과 지식.",
    descriptionEn: "Baseline dermatology knowledge underlying most aesthetic work.",
  },
  { key: "melasma", labelKo: "기미", labelEn: "Melasma", parentKey: "dermatology-basics" },
  { key: "acne", labelKo: "여드름", labelEn: "Acne", parentKey: "dermatology-basics" },
  { key: "rosacea", labelKo: "주사", labelEn: "Rosacea", parentKey: "dermatology-basics" },
  { key: "scar", labelKo: "흉터", labelEn: "Scar", parentKey: "dermatology-basics" },
  { key: "enlarged-pore", labelKo: "모공 확장", labelEn: "Enlarged Pore", parentKey: "dermatology-basics" },
  { key: "photoaging", labelKo: "광노화", labelEn: "Photoaging", parentKey: "dermatology-basics" },

  // 5. Patient communication
  {
    key: "patient-communication",
    labelKo: "영어 진료 표현",
    labelEn: "Patient Communication (English)",
    descriptionKo: "외국인 환자에게 설명 가능해야 하는 영어 표현.",
    descriptionEn: "English phrasing you must be able to explain to foreign patients.",
  },
  {
    key: "swelling-bruising-downtime",
    labelKo: "붓기/멍/다운타임 설명",
    labelEn: "Swelling / Bruising / Downtime",
    parentKey: "patient-communication",
  },
  {
    key: "maintenance-interval",
    labelKo: "유지 기간 설명",
    labelEn: "Maintenance Interval",
    parentKey: "patient-communication",
  },
  {
    key: "realistic-expectation",
    labelKo: "현실적 기대치 설명",
    labelEn: "Realistic Expectation Setting",
    parentKey: "patient-communication",
  },

  // 6. Safety screening
  {
    key: "safety-screening",
    labelKo: "안전성 문진",
    labelEn: "Patient Safety Screening",
    descriptionKo: "시술 전 반드시 확인해야 하는 안전성 항목.",
    descriptionEn: "Screening items that must be checked before any procedure.",
  },
  { key: "anticoagulants", labelKo: "항응고제", labelEn: "Anticoagulants", parentKey: "safety-screening" },
  { key: "pregnancy", labelKo: "임신", labelEn: "Pregnancy", parentKey: "safety-screening" },
  { key: "autoimmune-disease", labelKo: "자가면역질환", labelEn: "Autoimmune Disease", parentKey: "safety-screening" },

  // 7. Skin type classification
  {
    key: "skin-type-classification",
    labelKo: "피부타입 분류",
    labelEn: "Skin Type Classification",
    descriptionKo: "동남아·중동·라틴계 등 다양한 환자 대응을 위한 분류.",
    descriptionEn: "Classification needed to treat a diverse international patient base.",
  },
  {
    key: "fitzpatrick-skin-type",
    labelKo: "Fitzpatrick 피부타입",
    labelEn: "Fitzpatrick Skin Type",
    parentKey: "skin-type-classification",
  },

  // 8. Marketing assets
  {
    key: "marketing-assets",
    labelKo: "마케팅 자산",
    labelEn: "Marketing Assets",
    descriptionKo: "표준화된 전후사진 등 마케팅 자산 관리.",
    descriptionEn: "Standardized before/after photos and other marketing assets.",
  },
  {
    key: "before-after-standardization",
    labelKo: "전후사진 표준화",
    labelEn: "Before/After Standardization",
    parentKey: "marketing-assets",
  },
];

export function getCategory(key: string): CategoryDef {
  const category = CATEGORY_TAXONOMY.find((c) => c.key === key);
  if (!category) throw new Error(`Unknown category key: ${key}`);
  return category;
}

export function getChildCategories(parentKey: string): CategoryDef[] {
  return CATEGORY_TAXONOMY.filter((c) => c.parentKey === parentKey);
}

export function getTopLevelCategories(): CategoryDef[] {
  return CATEGORY_TAXONOMY.filter((c) => !c.parentKey);
}

/** Categories entries can actually be filed under — anything with no
 * children, since parent categories are organizational only. */
export function getLeafCategories(): CategoryDef[] {
  const parentKeys = new Set(CATEGORY_TAXONOMY.map((c) => c.parentKey).filter(Boolean));
  return CATEGORY_TAXONOMY.filter((c) => !parentKeys.has(c.key));
}

/** Full slash-path from root to this category, e.g. "procedure-technique/botox". */
export function getCategoryPath(key: string): string {
  const segments: string[] = [];
  let current: CategoryDef | undefined = getCategory(key);
  while (current) {
    segments.unshift(current.key);
    current = current.parentKey ? getCategory(current.parentKey) : undefined;
  }
  return segments.join("/");
}
