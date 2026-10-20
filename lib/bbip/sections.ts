import type { ContentTier } from "../codex/types";
import type { SectionKey, TurnRequest } from "./types";

export type SectionGroup = "safety" | "practice" | "business";
export type ModelTier = "opus" | "sonnet";

export interface SectionDef {
  key: SectionKey;
  label: string;
  /** English name, shown above the Korean label. */
  en: string;
  emoji: string;
  group: SectionGroup;
  /** Safety-critical sections go to Opus; the rest to Sonnet. */
  tier: ModelTier;
  /** Default content tier when the card is promoted to a note. */
  promoteTier: ContentTier;
  /** What the model must produce for this section. */
  instruction: string;
}

export const SECTIONS: SectionDef[] = [
  {
    key: "cautions",
    label: "유의사항",
    en: "Precautions",
    emoji: "🛡️",
    group: "safety",
    tier: "opus",
    promoteTier: "procedure_tip",
    instruction:
      "시술 전·중에 반드시 확인할 유의사항을 정리하세요: 금기/상대금기, 복용약·기저질환과의 상호작용, 시술 전 환자에게 물어볼 확인 질문, 동의서에 꼭 넣을 항목. 플래그 관련 내용을 맨 위에.",
  },
  {
    key: "adverse",
    label: "부작용·대처법",
    en: "Complications & Management",
    emoji: "🚑",
    group: "safety",
    tier: "opus",
    promoteTier: "procedure_tip",
    instruction:
      "예상 부작용을 흔한 것/드물지만 중대한 것으로 나누고, 각각의 초기 징후와 단계별 즉시 대처법을 쓰세요. 응급 상황(혈관 폐색 등)은 별도의 \"> **응급**\" 블록으로.",
  },
  {
    key: "ddx",
    label: "감별질환",
    en: "Differential Diagnosis",
    emoji: "🔍",
    group: "safety",
    tier: "opus",
    promoteTier: "deep_study",
    instruction:
      "주소·질환과 감별할 질환을 표로 정리하세요: 감별질환 | 구별 포인트(임상 양상·더모스코피·우드램프 등) | 치료 방향 차이. 오진 시 위험이 큰 것부터.",
  },
  {
    key: "tips",
    label: "시술팁",
    en: "Technique Tips",
    emoji: "💉",
    group: "practice",
    tier: "sonnet",
    promoteTier: "procedure_tip",
    instruction:
      "시술 술기 팁: 제품·파라미터(노트에 있는 수치만), 주입 깊이·층, 디자인, 흔한 실수와 피하는 법을 불릿으로.",
  },
  {
    key: "schedule",
    label: "간격·회차",
    en: "Interval & Sessions",
    emoji: "📅",
    group: "practice",
    tier: "sonnet",
    promoteTier: "procedure_tip",
    instruction:
      "시술 간격, 권장 회차, 유지 주기, 다른 시술과 병행할 때의 순서와 간격을 표로 정리하세요.",
  },
  {
    key: "homecare",
    label: "홈케어",
    en: "Home Care",
    emoji: "🧴",
    group: "practice",
    tier: "sonnet",
    promoteTier: "chairside_talk",
    instruction:
      "시술 후 홈케어를 환자에게 그대로 읽어줄 수 있는 문장으로: 당일 / 1~3일 / 1~2주 구간별로 해야 할 것과 피할 것.",
  },
  {
    key: "notes",
    label: "참고사항",
    en: "Clinical Notes",
    emoji: "📝",
    group: "practice",
    tier: "sonnet",
    promoteTier: "procedure_tip",
    instruction:
      "그 밖의 참고사항: 환자 특성(나이·피부타입 등)에 따른 조정, 기대치 관리, 기록·사진 촬영 팁.",
  },
  {
    key: "marketing",
    label: "마케팅·업셀링",
    en: "Marketing & Upsell",
    emoji: "💬",
    group: "business",
    tier: "sonnet",
    promoteTier: "chairside_talk",
    instruction:
      "상담 멘트와 업셀링: 환자 관점의 이점 설명 2~3문장, 자연스러운 병행·패키지 제안 2~3개(왜 같이 하면 좋은지). 효과 보장·과장 표현은 의료광고 규정상 금지.",
  },
  {
    key: "alternatives",
    label: "비슷한 치료",
    en: "Alternative Treatments",
    emoji: "🔄",
    group: "business",
    tier: "sonnet",
    promoteTier: "deep_study",
    instruction:
      "비슷한 치료·대안·병행 시술 비교 표: 시술 | 원리 | 장점 | 단점 | 이 환자에게 적합도.",
  },
];

const BY_KEY = new Map(SECTIONS.map((section) => [section.key, section]));

export function getSection(key: SectionKey): SectionDef {
  const section = BY_KEY.get(key);
  if (!section) throw new Error(`Unknown BBIP section: ${key}`);
  return section;
}

/** Card heading for a turn — shared by the UI, prompts, and note titles. */
export function turnTitle(turn: Pick<TurnRequest, "kind" | "sectionKey" | "question">): string {
  if (turn.kind === "brief") return "⚡ 핵심 브리핑";
  if (turn.kind === "section" && turn.sectionKey) {
    const section = getSection(turn.sectionKey);
    return `${section.emoji} ${section.label}`;
  }
  if (turn.kind === "literature") return "🔬 문헌 근거";
  return `💬 ${turn.question ?? "질문"}`;
}
