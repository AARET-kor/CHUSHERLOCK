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
  // 1a. Botulinum toxin — split by indication + product knowledge
  { key: "botox", labelKo: "보톡스", labelEn: "Botulinum Toxin", parentKey: "procedure-technique" },
  { key: "botox-wrinkle", labelKo: "주름 보톡스", labelEn: "Wrinkle Botox", parentKey: "botox",
    descriptionKo: "이마·미간·눈가·콧잔등·자갈턱 등 표정 주름." },
  { key: "botox-muscle", labelKo: "근육 축소 보톡스", labelEn: "Muscle-Reduction Botox", parentKey: "botox",
    descriptionKo: "턱근육·침샘·측두근·승모근·종아리·허벅지." },
  { key: "botox-hyperhidrosis", labelKo: "다한증 보톡스", labelEn: "Hyperhidrosis Botox", parentKey: "botox" },
  { key: "skin-botox", labelKo: "스킨보톡스", labelEn: "Skin (Micro) Botox", parentKey: "botox",
    descriptionKo: "표층 주입 — 턱선 리프팅, 모공, 목주름." },
  { key: "botox-products", labelKo: "톡신 제품 지식", labelEn: "Toxin Products", parentKey: "botox",
    descriptionKo: "코어톡스·제오민·엘러간(보톡스)·디스포트 비교, 단위 환산, 내성." },

  // 1b. Filler — face/body/dissolving/collagen stimulators
  { key: "filler", labelKo: "필러", labelEn: "Dermal Filler", parentKey: "procedure-technique" },
  { key: "face-filler", labelKo: "페이스 필러", labelEn: "Face Filler", parentKey: "filler" },
  { key: "body-filler", labelKo: "바디 필러", labelEn: "Body Filler", parentKey: "filler",
    descriptionKo: "엉덩이·어깨·손등·귀 등 대용량/부위별 필러." },
  { key: "filler-dissolving", labelKo: "필러 용해", labelEn: "Filler Dissolving (Hyaluronidase)", parentKey: "filler" },
  { key: "collagen-stimulator", labelKo: "콜라겐 자극 필러", labelEn: "Collagen Stimulator", parentKey: "filler",
    descriptionKo: "엘란쎄(PCL)·라풀렌·쥬베룩 볼륨 등 자극형 제제." },

  // 1c. Skin boosters — by ingredient family
  { key: "skin-booster", labelKo: "스킨부스터", labelEn: "Skin Booster", parentKey: "procedure-technique" },
  { key: "rejuran", labelKo: "리쥬란", labelEn: "Rejuran", parentKey: "skin-booster",
    descriptionKo: "힐러·HB·아이 라인업 포함." },
  { key: "juvelook", labelKo: "쥬베룩", labelEn: "Juvelook", parentKey: "skin-booster" },
  { key: "pn-booster", labelKo: "PN 부스터", labelEn: "PN Booster", parentKey: "skin-booster",
    descriptionKo: "비타란·필로드·레스노베 등 PN/PDRN 계열." },
  { key: "ha-booster", labelKo: "HA 부스터", labelEn: "HA Booster", parentKey: "skin-booster",
    descriptionKo: "스킨바이브 등 히알루론산 계열." },
  { key: "exosome", labelKo: "엑소좀", labelEn: "Exosome", parentKey: "skin-booster" },

  // 1d. Lasers & toning
  { key: "laser-toning", labelKo: "레이저 토닝", labelEn: "Laser Toning", parentKey: "procedure-technique" },
  { key: "pico-toning", labelKo: "피코토닝", labelEn: "Pico Toning", parentKey: "laser-toning" },
  { key: "genesis", labelKo: "제네시스", labelEn: "Genesis", parentKey: "laser-toning",
    descriptionKo: "색소·혈관·홍조 선택 조사, 저자극 콜라겐 재생 토닝." },
  { key: "ipl", labelKo: "IPL", labelEn: "IPL", parentKey: "procedure-technique" },
  { key: "pico-laser", labelKo: "피코 (색소치료)", labelEn: "Pico Laser", parentKey: "procedure-technique" },
  { key: "co2-laser", labelKo: "CO2", labelEn: "CO2 Laser", parentKey: "procedure-technique" },

  // 1e. HIFU / RF / energy devices — split by device family
  { key: "hifu", labelKo: "HIFU", labelEn: "HIFU", parentKey: "procedure-technique" },
  { key: "ulthera", labelKo: "울쎄라", labelEn: "Ulthera", parentKey: "hifu" },
  { key: "shrink", labelKo: "슈링크·바디슈링크", labelEn: "Shrink (Face/Body HIFU)", parentKey: "hifu" },
  { key: "rf", labelKo: "RF", labelEn: "Radiofrequency", parentKey: "procedure-technique" },
  { key: "thermage", labelKo: "써마지", labelEn: "Thermage", parentKey: "rf",
    descriptionKo: "Thermage FLX — 아이써마지 포함." },
  { key: "inmode", labelKo: "인모드", labelEn: "InMode", parentKey: "rf",
    descriptionKo: "FX(포커스드)·Forma 핸드피스." },
  { key: "microneedle-rf", labelKo: "니들 RF", labelEn: "Microneedle RF", parentKey: "rf",
    descriptionKo: "모피우스8·포텐자 — 모공/흉터/약물 정밀 주입." },
  { key: "rf-ems", labelKo: "RF+EMS", labelEn: "RF + EMS", parentKey: "rf",
    descriptionKo: "이브타이탄 등 고주파+전기 근육 자극 복합." },
  { key: "onda", labelKo: "온다", labelEn: "Onda (Microwave)", parentKey: "procedure-technique",
    descriptionKo: "마이크로웨이브 에너지 기반 지방층 타깃팅." },
  { key: "titanium-lifting", labelKo: "티타늄 리프팅", labelEn: "Titanium Lifting", parentKey: "procedure-technique",
    descriptionKo: "3파장 레이저 즉각 리프팅·타이트닝." },
  { key: "ldm", labelKo: "LDM", labelEn: "LDM", parentKey: "procedure-technique" },

  // 1f. Threads, regenerative, body & metabolic
  { key: "thread-lifting", labelKo: "실리프팅", labelEn: "Thread Lifting", parentKey: "procedure-technique",
    descriptionKo: "민트실·모노실·잼버·폭시아이·이마거상·코실." },
  { key: "stem-cell", labelKo: "줄기세포 피부주사", labelEn: "Stem-Cell Skin Therapy", parentKey: "procedure-technique",
    descriptionKo: "줄기세포 유래 인자 활용 피부 재생 주사." },
  { key: "lipolysis-injection", labelKo: "지방분해주사", labelEn: "Lipolysis Injection", parentKey: "procedure-technique",
    descriptionKo: "브이올렛 등 식약처 허가 제제 및 커스텀 용액." },

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

  // 8. IV & wellness
  {
    key: "wellness-injection",
    labelKo: "수액·영양주사",
    labelEn: "IV & Wellness",
    descriptionKo: "피로 회복·항산화·항노화 수액 프로그램.",
    descriptionEn: "IV programs for recovery, antioxidation, and anti-aging.",
  },
  { key: "vitamin-iv", labelKo: "비타민·영양 수액", labelEn: "Vitamin / Nutrient IV", parentKey: "wellness-injection",
    descriptionKo: "비타민·신데렐라·백옥·마늘·태반 등." },
  { key: "nad-iv", labelKo: "NAD+ 주사", labelEn: "NAD+ IV", parentKey: "wellness-injection" },

  // 9. Weight management
  {
    key: "weight-management",
    labelKo: "다이어트",
    labelEn: "Weight Management",
    descriptionKo: "체중 감량 약물 치료.",
    descriptionEn: "Pharmacologic weight management.",
  },
  { key: "glp1", labelKo: "GLP-1 (위고비·마운자로)", labelEn: "GLP-1 Agonists", parentKey: "weight-management",
    descriptionKo: "용량 단계, 부작용, 식욕 조절 기전." },

  // 10. Skincare programs & acne procedures
  {
    key: "skincare-program",
    labelKo: "피부관리·필링",
    labelEn: "Skincare & Peels",
    descriptionKo: "관리실 시술과 필링 프로그램.",
    descriptionEn: "Clinic skincare and peel programs.",
  },
  { key: "peel", labelKo: "필링", labelEn: "Peels", parentKey: "skincare-program",
    descriptionKo: "아쿠아필·라라필 등." },
  { key: "gold-ptt", labelKo: "골드 PTT", labelEn: "Gold PTT", parentKey: "skincare-program" },
  { key: "cryo", labelKo: "크라이오", labelEn: "Cryotherapy", parentKey: "skincare-program" },
  { key: "acne-care", labelKo: "여드름 시술", labelEn: "Acne Procedures", parentKey: "skincare-program",
    descriptionKo: "염증주사·압출·서브시전." },

  // 11. Marketing assets
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
