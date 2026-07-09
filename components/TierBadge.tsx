import { getTierInfo } from "../lib/codex/tiers";
import type { ContentTier } from "../lib/codex/types";

const TIER_COLORS: Record<ContentTier, string> = {
  procedure_tip: "bg-emerald-50 text-emerald-900 border-emerald-200",
  chairside_talk: "bg-sky-50 text-sky-900 border-sky-200",
  deep_study: "bg-violet-50 text-violet-900 border-violet-200",
  base_medical_knowledge: "bg-amber-50 text-amber-900 border-amber-200",
};

export function TierBadge({ tier }: { tier: ContentTier }) {
  const info = getTierInfo(tier);
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs ${TIER_COLORS[tier]}`}>
      {info.labelKo} / {info.labelEn}
    </span>
  );
}
