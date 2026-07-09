import { getTierInfo } from "../lib/codex/tiers";
import type { ContentTier } from "../lib/codex/types";

const TIER_COLORS: Record<ContentTier, string> = {
  procedure_tip: "bg-emerald-900 text-emerald-200 border-emerald-700",
  chairside_talk: "bg-sky-900 text-sky-200 border-sky-700",
  deep_study: "bg-violet-900 text-violet-200 border-violet-700",
  base_medical_knowledge: "bg-amber-900 text-amber-200 border-amber-700",
};

export function TierBadge({ tier }: { tier: ContentTier }) {
  const info = getTierInfo(tier);
  return (
    <span className={`inline-block rounded border px-2 py-0.5 text-xs ${TIER_COLORS[tier]}`}>
      {info.labelKo} / {info.labelEn}
    </span>
  );
}
