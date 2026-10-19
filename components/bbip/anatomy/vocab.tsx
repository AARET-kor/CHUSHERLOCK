import { DEPTHS, LAYERS, RISKS, type LayerKey, type RiskLevel } from "../../../lib/bbip/anatomy/layers";
import type { AtlasStructure } from "../../../lib/bbip/anatomy/atlas";

// Small presentational helpers shared by the anatomy card.

export const LAYER_BY_KEY = new Map(LAYERS.map((l) => [l.key, l]));
const DEPTH_KO = new Map(DEPTHS.map((d) => [d.key, d.ko]));

export function layerColor(key: LayerKey): string {
  return LAYER_BY_KEY.get(key)?.color ?? "#051A24";
}

export function depthText(s: Pick<AtlasStructure, "depths">): string {
  return s.depths.map((d) => DEPTH_KO.get(d)).join(" → ");
}

const RISK_STYLE: Record<RiskLevel, string> = {
  critical: "bg-red-600 text-white",
  high: "bg-red-50 text-red-800 ring-1 ring-inset ring-red-200",
  moderate: "bg-amber-50 text-amber-900 ring-1 ring-inset ring-amber-200",
  low: "bg-mist text-ink/75 ring-1 ring-inset ring-ink/10",
};

export function RiskPill({ risk }: { risk: RiskLevel }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${RISK_STYLE[risk]}`}
    >
      위험 {RISKS[risk].ko}
    </span>
  );
}

export function sortByRisk<T extends Pick<AtlasStructure, "risk">>(items: T[]): T[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => RISKS[a.item.risk].rank - RISKS[b.item.risk].rank || a.index - b.index)
    .map(({ item }) => item);
}
