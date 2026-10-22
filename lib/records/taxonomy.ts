// lib/records/taxonomy.ts
// Procedure taxonomy for record tags: major (Laser, Filler, …) › mid
// (modality or area) › minor (device or product). Deterministic rules over
// the procedure text the doctor typed — nothing here calls a model, so the
// same words always land in the same place. Pure; used on server and client.

export type MajorKey = "filler" | "botox" | "lifting" | "laser" | "booster" | "stimulator" | "skin" | "other";

export interface MajorDef {
  key: MajorKey;
  en: string;
  ko: string;
  /** dot = the hue (categorical slots of the dataviz reference palette);
   * bg/border = tints of it; text = the darkest shade of the same hue. */
  color: { dot: string; bg: string; border: string; text: string };
}

export const MAJORS: MajorDef[] = [
  { key: "filler", en: "Filler", ko: "필러", color: { dot: "#2a78d6", bg: "#2a78d61f", border: "#2a78d659", text: "#174d8c" } },
  { key: "lifting", en: "Lifting", ko: "리프팅", color: { dot: "#eb6834", bg: "#eb68341f", border: "#eb683459", text: "#8f3410" } },
  { key: "laser", en: "Laser", ko: "레이저", color: { dot: "#1baf7a", bg: "#1baf7a1f", border: "#1baf7a59", text: "#0a5c3f" } },
  { key: "botox", en: "Botox", ko: "보톡스", color: { dot: "#eda100", bg: "#eda10024", border: "#eda10066", text: "#6b4700" } },
  { key: "booster", en: "Booster", ko: "스킨부스터", color: { dot: "#e87ba4", bg: "#e87ba424", border: "#e87ba466", text: "#8c2f55" } },
  { key: "stimulator", en: "Stimulator", ko: "콜라겐 자극", color: { dot: "#008300", bg: "#0083001a", border: "#00830052", text: "#0a520a" } },
  { key: "skin", en: "Skin care", ko: "스킨케어", color: { dot: "#6250d6", bg: "#6250d61a", border: "#6250d652", text: "#3a2c96" } },
  { key: "other", en: "Other", ko: "기타", color: { dot: "#6b7c86", bg: "#6b7c861a", border: "#6b7c8652", text: "#44525a" } },
];

export const MAJOR_BY_KEY = new Map(MAJORS.map((m) => [m.key, m]));

type Rule = [label: string, pattern: RegExp];

interface MajorRules {
  key: MajorKey;
  match: RegExp;
  mids: Rule[];
  minors: Rule[];
}

// Order matters: specific before general (스킨보톡스 before 보톡스 is handled
// inside botox; 쥬베룩 볼륨 before 쥬베룩; 필러 용해 stays with filler).
const RULES: MajorRules[] = [
  {
    key: "stimulator",
    match: /쥬베룩\s*볼륨|스컬트라|레디어스|래디어스|엘란쎄|radiesse|sculptra|ellans[eé]|plla|caha|콜라겐\s*자극/i,
    mids: [
      ["쥬베룩 볼륨", /쥬베룩\s*볼륨/],
      ["스컬트라", /스컬트라|sculptra/i],
      ["레디어스", /레디어스|래디어스|radiesse/i],
      ["엘란쎄", /엘란쎄|ellans[eé]/i],
    ],
    minors: [],
  },
  {
    key: "botox",
    match: /보톡스|톡신|보툴|botox|toxin|제오민|나보타|보툴렉스|코어톡스|디스포트|dysport|더모\s*톡신/i,
    mids: [
      ["스킨보톡스", /스킨\s*보톡스|더모\s*톡신|micro\s*botox/i],
      ["이마·미간", /이마|미간|11자|forehead|glabella/i],
      ["눈가", /눈가|눈꼬리|crow/i],
      ["교근·사각턱", /교근|사각턱|masseter/i],
      ["턱끝", /턱끝|mentalis/i],
      ["입꼬리·입가", /입꼬리|입가|dao|잇몸/i],
      ["승모근", /승모/],
      ["다한증", /다한증|겨드랑이/],
    ],
    minors: [
      ["제오민", /제오민|xeomin/i],
      ["나보타", /나보타/],
      ["보툴렉스", /보툴렉스/],
      ["코어톡스", /코어톡스/],
      ["디스포트", /디스포트|dysport/i],
    ],
  },
  {
    key: "booster",
    match: /리쥬란|쥬베룩|스킨\s*부스터|부스터|물광|pdrn|pn\b|프로파일로|profhilo|스킨바이브|skinvive|엑소좀|리투오|샤넬\s*주사/i,
    mids: [
      ["리쥬란", /리쥬란|pdrn|pn\b/i],
      ["쥬베룩", /쥬베룩/],
      ["리투오", /리투오/],
      ["물광", /물광|스킨바이브|skinvive/i],
      ["프로파일로", /프로파일로|profhilo/i],
      ["엑소좀", /엑소좀/],
    ],
    minors: [],
  },
  {
    key: "filler",
    match: /필러|filler|레스틸렌|쥬비덤|벨로테로|뉴라미스|이브아르|restylane|juvederm|belotero|히알루로니다|용해/i,
    mids: [
      ["필러 용해", /용해|히알루로니다|hyaluronidase/i],
      ["팔자", /팔자|비순|nasolabial/i],
      ["입술", /입술|lip/i],
      ["코", /(?<![가-힣])코(?![그어스팅로])|콧대|nose/i],
      ["턱·턱선", /턱|chin|jaw/i],
      ["이마", /이마|forehead/i],
      ["관자", /관자|템플|temple/i],
      ["눈밑", /눈\s*밑|눈물\s*고랑|tear/i],
      ["앞광대·중안면", /광대|중안면|midface|볼(?!륨)/i],
      ["마리오네트", /마리오네트|입가/],
    ],
    minors: [
      ["쥬비덤", /쥬비덤|juvederm/i],
      ["레스틸렌", /레스틸렌|restylane/i],
      ["벨로테로", /벨로테로|belotero/i],
      ["뉴라미스", /뉴라미스/],
      ["이브아르", /이브아르/],
    ],
  },
  {
    key: "lifting",
    match: /리프팅|실\b|민트실|코그|울쎄라|슈링크|써마지|인모드|올리지오|티타늄|hifu|rf\b|thread|ulthera|thermage|온다/i,
    mids: [
      ["실리프팅", /실\s*리프팅|민트실|코그|녹는\s*실|pdo|thread|(?<![가-힣])실(?![가-힣])/i],
      ["HIFU", /울쎄라|슈링크|hifu|ulthera|더블로|리니어지/i],
      ["RF", /써마지|인모드|올리지오|thermage|rf\b|티타늄|온다/i],
    ],
    minors: [
      ["민트실", /민트실/],
      ["울쎄라", /울쎄라|ulthera/i],
      ["슈링크", /슈링크/],
      ["써마지", /써마지|thermage/i],
      ["인모드", /인모드/],
      ["올리지오", /올리지오/],
      ["티타늄", /티타늄/],
      ["온다", /온다/],
    ],
  },
  {
    key: "laser",
    match: /레이저|laser|토닝|피코|프락셀|프락셔널|co2|ipl|브이빔|v-?beam|제모|클라리티|젠틀맥스|큐스위치|점\s*빼기|bbl/i,
    mids: [
      ["토닝", /토닝|toning/i],
      ["리서페이싱", /프락셀|프락셔널|fraxel|co2|어븀/i],
      ["혈관·홍조", /ipl|브이빔|v-?beam|bbl|홍조|혈관/i],
      ["제모", /제모/],
      ["색소·점", /점\s*빼기|큐스위치|색소\s*레이저|잡티/],
    ],
    minors: [
      ["피코", /피코|pico/i],
      ["프락셀", /프락셀|fraxel/i],
      ["CO2", /co2/i],
      ["IPL", /ipl/i],
      ["브이빔", /브이빔|v-?beam/i],
      ["클라리티", /클라리티/],
      ["젠틀맥스", /젠틀맥스/],
    ],
  },
  {
    key: "skin",
    match: /필링|peel|아쿠아필|mts|더마펜|여드름|압출|관리|모델링|lhr/i,
    mids: [
      ["필링", /필링|peel|아쿠아필/i],
      ["MTS", /mts|더마펜/i],
      ["여드름", /여드름|압출/],
      ["관리", /관리|모델링/],
    ],
    minors: [],
  },
];

export interface Classification {
  major: MajorKey;
  mid: string | null;
  minor: string | null;
}

const first = (rules: Rule[], text: string) => rules.find(([, re]) => re.test(text))?.[0] ?? null;

export function classifyProcedure(text: string): Classification {
  const rule = RULES.find((r) => r.match.test(text));
  if (!rule) return { major: "other", mid: null, minor: null };
  const mid = first(rule.mids, text);
  const minor = first(rule.minors, text);
  return { major: rule.key, mid, minor: minor && minor !== mid ? minor : null };
}

/** ["Laser", "토닝", "피코"] — the major's English name, then mid, minor. */
export function tagPath(c: Classification): string[] {
  return [MAJOR_BY_KEY.get(c.major)!.en, ...(c.mid ? [c.mid] : []), ...(c.minor ? [c.minor] : [])];
}

export function majorOf(key: MajorKey): MajorDef {
  return MAJOR_BY_KEY.get(key)!;
}
