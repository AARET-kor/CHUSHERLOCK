import type { ContentTier, ContentTierInfo } from "./types";

// The four content tiers the intake flow must sort every piece of material
// into, per the product brief: simple procedure tips vs. chairside talking
// points vs. deep study material vs. foundational medical knowledge.
export const CONTENT_TIERS: ContentTierInfo[] = [
  {
    id: "procedure_tip",
    labelKo: "시술 팁",
    labelEn: "Procedure Tip",
    descriptionKo: "파라미터, 사용법, 간단한 원리 등 바로 써먹는 실무 정보.",
    descriptionEn:
      "Parameters, usage, and simple principles you apply directly during a procedure.",
  },
  {
    id: "chairside_talk",
    labelKo: "시술 중 설명 멘트",
    labelEn: "Chairside Talking Point",
    descriptionKo: "시술 중/상담 중 환자에게 말해줄 설명 문구.",
    descriptionEn:
      "What to say to the patient during the procedure or consultation.",
  },
  {
    id: "deep_study",
    labelKo: "심화 학습",
    labelEn: "Deep Study",
    descriptionKo: "심화로 공부하면 좋은 딥한 내용, 논문 수준의 디테일.",
    descriptionEn:
      "Deeper material worth studying beyond daily practice — paper-level detail.",
  },
  {
    id: "base_medical_knowledge",
    labelKo: "베이스 의학지식",
    labelEn: "Base Medical Knowledge",
    descriptionKo: "다른 모든 내용의 전제가 되는 기초 해부학/생리학/약리학 지식.",
    descriptionEn:
      "Foundational anatomy/physiology/pharmacology knowledge everything else builds on.",
  },
];

export function getTierInfo(tier: ContentTier): ContentTierInfo {
  const info = CONTENT_TIERS.find((t) => t.id === tier);
  if (!info) throw new Error(`Unknown content tier: ${tier}`);
  return info;
}
