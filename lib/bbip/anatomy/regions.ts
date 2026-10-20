import type { ParsedCase } from "../types";
import { ATLAS_BY_ID, type AtlasStructure, type Pt } from "./atlas";
import { PROCEDURE_CATEGORIES, type DepthKey, type ProcedureCategory } from "./layers";

// Procedure chips → procedure categories → face regions, deterministically.
// Nothing here calls a model, so the anatomy card renders with the session.

export type RegionKey =
  | "forehead-glabella"
  | "temple"
  | "nose"
  | "tear-trough"
  | "midface"
  | "nasolabial"
  | "lips"
  | "chin-jawline";

/** Recommended injection / insertion plane, drawn as the green band. An
 * empty `depths` means "no standard plane" and only the note is shown. */
export interface PlaneSpec {
  depths: DepthKey[];
  note: string;
}

export interface RegionDef {
  key: RegionKey;
  ko: string;
  en: string;
  keywords: RegExp;
  structureIds: string[];
  /** Front-view highlight outline (viewer's right half; mirrored). */
  area: Pt[];
  planes: Record<ProcedureCategory, PlaneSpec>;
}

const THREAD: PlaneSpec = { depths: ["subcutaneous"], note: "피하지방층 — SMAS 위, 피부 딤플 없이" };
const BOOSTER: PlaneSpec = { depths: ["skin"], note: "진피 내(미세 분할 주입) — 제품 IFU 확인" };
const DISSOLVE: PlaneSpec = {
  depths: [],
  note: "필러가 있는 층에 주입 — 가능하면 초음파로 위치·층 확인",
};
const BOTOX: PlaneSpec = { depths: ["smas"], note: "표정근(근육층) — 확산 방향 주의" };
const NOT_TYPICAL: PlaneSpec = {
  depths: [],
  note: "일반적으로 권장 부위 아님 — 제품 IFU 확인",
};

export const REGIONS: RegionDef[] = [
  {
    key: "forehead-glabella",
    ko: "이마·미간",
    en: "Forehead · glabella",
    keywords: /이마|미간|11자|forehead|glabella|frontalis|corrugator|procerus/i,
    structureIds: [
      "glabella-danger",
      "supratrochlear-artery",
      "supraorbital-artery",
      "supraorbital-nerve",
      "superficial-temporal-artery",
      "facial-nerve-temporal",
      "frontalis",
      "corrugator",
      "procerus",
      "entry-forehead",
    ],
    area: [[112, 40], [150, 36], [180, 56], [184, 98], [150, 102], [112, 102]],
    planes: {
      "face-filler": { depths: ["periosteum"], note: "이마는 골막 위(모상건막하), 미간은 진피·피하에 얕게 소량" },
      "filler-dissolving": DISSOLVE,
      "collagen-stimulator": { depths: ["periosteum"], note: "이마 골막 위 — 미간 주입은 피함" },
      "thread-lifting": THREAD,
      "skin-booster": BOOSTER,
      botox: BOTOX,
    },
  },
  {
    key: "temple",
    ko: "관자",
    en: "Temple",
    keywords: /관자|템플|temple|temporal/i,
    structureIds: [
      "temporal-danger",
      "superficial-temporal-artery",
      "deep-temporal-artery",
      "middle-temporal-vein",
      "facial-nerve-temporal",
      "temporalis",
      "temporal-fat-pad",
      "entry-temple",
      "entry-thread-temple",
    ],
    area: [[180, 60], [204, 80], [210, 130], [207, 154], [190, 142], [183, 100]],
    planes: {
      "face-filler": { depths: ["subcutaneous", "periosteum"], note: "골막 위(바늘, 볼루스) 또는 피하(캐뉼라) — 중간 층(지방패드) 피함" },
      "filler-dissolving": DISSOLVE,
      "collagen-stimulator": { depths: ["subcutaneous", "periosteum"], note: "피하(캐뉼라) 또는 골막 위 — 제품 IFU 확인" },
      "thread-lifting": THREAD,
      "skin-booster": BOOSTER,
      botox: BOTOX,
    },
  },
  {
    key: "nose",
    ko: "코",
    en: "Nose",
    keywords: /(?<![가-힣])코(?![그어스팅로])|콧대|콧볼|비배|nose|nasal|rhino/i,
    structureIds: [
      "nasal-danger",
      "dorsal-nasal-artery",
      "lateral-nasal-artery",
      "angular-artery",
      "angular-vein",
      "procerus",
      "levator-labii",
      "entry-nose",
    ],
    area: [[118, 118], [133, 120], [143, 178], [137, 190], [118, 190]],
    planes: {
      "face-filler": { depths: ["periosteum"], note: "정중선 골막·연골막 바로 위" },
      "filler-dissolving": DISSOLVE,
      "collagen-stimulator": NOT_TYPICAL,
      "thread-lifting": { depths: ["periosteum"], note: "코 실은 정중선 골막·연골막 위 — 일반 리프팅 실과 다름" },
      "skin-booster": BOOSTER,
      botox: BOTOX,
    },
  },
  {
    key: "tear-trough",
    ko: "눈가·눈밑",
    en: "Periorbital · tear trough",
    keywords: /눈\s*밑|눈\s*가|눈꼬리|눈물\s*고랑|다크\s*서클|애교|인디언|tear\s*trough|infraorbital|crow['’]?s?\s*feet|orbicularis\s*oculi/i,
    structureIds: [
      "tear-trough-danger",
      "angular-artery",
      "infraorbital-artery",
      "infraorbital-nerve",
      "angular-vein",
      "orbital-retaining-ligament",
      "soof",
      "orbicularis-oculi",
      "entry-tear-trough",
    ],
    area: [[130, 128], [176, 128], [184, 146], [160, 162], [136, 166]],
    planes: {
      "face-filler": { depths: ["periosteum"], note: "안륜근 아래 골막 위(캐뉼라), 안와지지인대 넘지 않게" },
      "filler-dissolving": DISSOLVE,
      "collagen-stimulator": NOT_TYPICAL,
      "thread-lifting": THREAD,
      "skin-booster": BOOSTER,
      botox: BOTOX,
    },
  },
  {
    key: "midface",
    ko: "중안면·볼",
    en: "Midface · cheek",
    keywords: /앞\s*광대|광대|중안면|미드\s*페이스|midface|cheek|zygomaticus|(?<![가-힣])볼(?!륨)/i,
    structureIds: [
      "zygomaticus-major",
      "facial-artery",
      "infraorbital-artery",
      "parotid-duct",
      "facial-nerve-zygomatic",
      "infraorbital-nerve",
      "facial-vein",
      "zygomatic-ligament",
      "orbicularis-oculi",
      "soof",
      "deep-medial-cheek-fat",
      "entry-midface",
      "entry-thread-temple",
    ],
    area: [[140, 146], [186, 144], [198, 180], [172, 202], [146, 188]],
    planes: {
      "face-filler": { depths: ["deep-fat", "periosteum"], note: "골막 위·심부 지방(SOOF·심부 내측 협부지방)" },
      "filler-dissolving": DISSOLVE,
      "collagen-stimulator": { depths: ["subcutaneous", "periosteum"], note: "골막 위 또는 피하(캐뉼라) — 제품 IFU 확인" },
      "thread-lifting": THREAD,
      "skin-booster": BOOSTER,
      botox: BOTOX,
    },
  },
  {
    key: "nasolabial",
    ko: "팔자",
    en: "Nasolabial",
    keywords: /팔자|비순|nasolabial|nlf/i,
    structureIds: [
      "perialar-danger",
      "angular-artery",
      "lateral-nasal-artery",
      "facial-artery",
      "facial-vein",
      "levator-labii",
      "nasolabial-fat",
      "entry-nasolabial",
    ],
    area: [[134, 176], [153, 180], [163, 214], [151, 224], [140, 198]],
    planes: {
      "face-filler": { depths: ["subcutaneous", "deep-fat"], note: "주름은 피하(캐뉼라), 상부 이상구 쪽은 골막 위 깊게 소량" },
      "filler-dissolving": DISSOLVE,
      "collagen-stimulator": { depths: ["subcutaneous"], note: "피하 캐뉼라 — 제품 IFU 확인" },
      "thread-lifting": THREAD,
      "skin-booster": BOOSTER,
      botox: BOTOX,
    },
  },
  {
    key: "lips",
    ko: "입술·입가",
    en: "Lips · perioral",
    keywords: /입술|입꼬리|입가|인중|구각|마리오네트|lip|perioral|marionette|depressor\s*anguli|(?<![a-z])dao(?![a-z])/i,
    structureIds: [
      "superior-labial-artery",
      "inferior-labial-artery",
      "facial-artery",
      "mental-artery",
      "mental-nerve",
      "orbicularis-oris",
      "depressor-anguli-oris",
      "entry-lips",
    ],
    area: [[118, 194], [148, 196], [158, 214], [148, 234], [118, 236]],
    planes: {
      "face-filler": { depths: ["subcutaneous"], note: "구륜근 표층(점막하 깊은 층 피함) — 입술 동맥은 대개 근육 심부" },
      "filler-dissolving": DISSOLVE,
      "collagen-stimulator": NOT_TYPICAL,
      "thread-lifting": THREAD,
      "skin-booster": BOOSTER,
      botox: BOTOX,
    },
  },
  {
    key: "chin-jawline",
    ko: "턱·턱선",
    en: "Chin · jawline",
    keywords: /턱|교근|저작근|하관|이부|chin|jaw|jowl|masseter/i,
    structureIds: [
      "facial-artery",
      "marginal-mandibular-nerve",
      "mental-artery",
      "mental-nerve",
      "facial-vein",
      "masseter",
      "depressor-anguli-oris",
      "mentalis",
      "jowl-fat",
      "mandibular-ligament",
      "entry-chin-jawline",
      "entry-thread-temple",
    ],
    area: [[118, 230], [152, 228], [178, 222], [202, 214], [198, 240], [178, 258], [150, 272], [118, 280]],
    planes: {
      "face-filler": { depths: ["subcutaneous", "periosteum"], note: "턱끝 골막 위, 턱선은 골막 위 또는 피하(캐뉼라)" },
      "filler-dissolving": DISSOLVE,
      "collagen-stimulator": { depths: ["subcutaneous", "periosteum"], note: "골막 위 또는 피하 — 제품 IFU 확인" },
      "thread-lifting": THREAD,
      "skin-booster": BOOSTER,
      botox: BOTOX,
    },
  },
];

export const REGION_KEYS: RegionKey[] = REGIONS.map((r) => r.key);
const REGION_BY_KEY = new Map(REGIONS.map((r) => [r.key, r]));

export function getRegion(key: RegionKey): RegionDef {
  const region = REGION_BY_KEY.get(key);
  if (!region) throw new Error(`Unknown anatomy region: ${key}`);
  return region;
}

export interface AnatomyPlan {
  categories: ProcedureCategory[];
  regions: RegionKey[];
  /** Botox only: the map shows the muscle layer and nothing else. */
  muscleOnly: boolean;
  /** No region word in the case: `regions` are the categories' usual sites,
   * shown with a "pick the region" notice rather than as the case's. */
  regionsGuessed: boolean;
}

// Rule order matters: dissolving before filler, 쥬베룩 볼륨 before 쥬베룩.
const CATEGORY_RULES: [ProcedureCategory, RegExp][] = [
  ["filler-dissolving", /용해|히알루로니다[제아]|hyaluronidase|리도라제|하이레넥스/i],
  [
    "collagen-stimulator",
    /쥬베룩\s*볼륨|엘란쎄|스컬트라|래디어스|레디어스|radiesse|sculptra|ellans[eé]|plla|caha|콜라겐\s*자극/i,
  ],
  ["thread-lifting", /실\s*리프팅|(민트|코그|녹는|pdo)\s*실|thread|잼버/i],
  ["skin-booster", /리쥬란|쥬베룩|스킨\s*부스터|부스터|물광|pdrn|프로파일로|profhilo|스킨바이브|skinvive/i],
  ["botox", /보톡스|톡신|보툴|botox|toxin|제오민|나보타|보툴렉스|코어톡스|디스포트|dysport/i],
  ["face-filler", /필러|filler|레스틸렌|쥬비덤|벨로테로|뉴라미스|이브아르|restylane|juvederm|belotero/i],
];

// Not injections into the mapped facial planes, so no anatomy card.
const EXCLUDE =
  /스킨\s*보톡스|더모\s*톡신|micro\s*botox|다한증|엑소좀|mts|더마펜|도포|바디\s*필러|엉덩이|가슴|손등|종아리|승모/i;

export function detectCategories(procedures: string[]): ProcedureCategory[] {
  const found = new Set<ProcedureCategory>();
  for (const text of procedures) {
    if (EXCLUDE.test(text)) continue;
    const rule = CATEGORY_RULES.find(([, re]) => re.test(text));
    if (rule) found.add(rule[0]);
  }
  return PROCEDURE_CATEGORIES.filter((c) => found.has(c));
}

export function detectRegions(texts: string[]): RegionKey[] {
  return REGIONS.filter((r) => texts.some((t) => r.keywords.test(t))).map((r) => r.key);
}

const DEFAULT_REGIONS: Record<ProcedureCategory, RegionKey[]> = {
  "face-filler": REGION_KEYS,
  "filler-dissolving": REGION_KEYS,
  "collagen-stimulator": ["midface", "temple", "chin-jawline"],
  "thread-lifting": ["midface", "chin-jawline", "temple"],
  "skin-booster": ["midface", "tear-trough", "forehead-glabella"],
  botox: ["forehead-glabella", "tear-trough", "lips", "chin-jawline"],
};

export function anatomyPlanFor(chips: ParsedCase): AnatomyPlan | null {
  const categories = detectCategories(chips.procedures);
  if (categories.length === 0) return null;
  let regions = detectRegions([...chips.procedures, ...chips.conditions]);
  const regionsGuessed = regions.length === 0;
  if (regionsGuessed) {
    // Union of each category's defaults, in category order.
    regions = [...new Set(categories.flatMap((c) => DEFAULT_REGIONS[c]))];
  }
  return { categories, regions, muscleOnly: categories.every((c) => c === "botox"), regionsGuessed };
}

/** A region's structures for this case: muscles only for botox, entry points
 * only for the case's categories. */
export function regionStructures(key: RegionKey, plan: AnatomyPlan): AtlasStructure[] {
  return getRegion(key)
    .structureIds.map((id) => ATLAS_BY_ID.get(id)!)
    .filter((s) => (plan.muscleOnly ? s.layer === "muscles" : true))
    .filter((s) => s.layer !== "entry" || (s.entryFor ?? []).some((c) => plan.categories.includes(c)));
}

/** Regions (case regions first) that contain the structure. */
export function regionsContaining(id: string, preferred: RegionKey[] = []): RegionKey[] {
  const all = REGIONS.filter((r) => r.structureIds.includes(id)).map((r) => r.key);
  return [...all.filter((k) => preferred.includes(k)), ...all.filter((k) => !preferred.includes(k))];
}
