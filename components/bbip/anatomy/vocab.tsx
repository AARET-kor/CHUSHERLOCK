import { DEPTHS, LAYERS, RISKS, type LayerKey, type RiskLevel } from "../../../lib/bbip/anatomy/layers";
import type { AtlasStructure } from "../../../lib/bbip/anatomy/atlas";

// Small presentational helpers shared by the anatomy section.

export const LAYER_BY_KEY = new Map(LAYERS.map((l) => [l.key, l]));
const DEPTH_KO = new Map(DEPTHS.map((d) => [d.key, d.ko]));

export function layerColor(key: LayerKey): string {
  return LAYER_BY_KEY.get(key)?.color ?? "#051a24";
}

export function depthText(s: Pick<AtlasStructure, "depths">): string {
  return s.depths.map((d) => DEPTH_KO.get(d)).join(" → ");
}

const RISK_STYLE: Record<RiskLevel, string> = {
  critical: "font-bold text-[#b42318]",
  high: "font-semibold text-[#b42318]",
  moderate: "font-semibold text-ink/80",
  low: "text-ink/65",
};

export function RiskText({ risk }: { risk: RiskLevel }) {
  return <span className={`whitespace-nowrap ${RISK_STYLE[risk]}`}>위험 {RISKS[risk].ko}</span>;
}

export function sortByRisk<T extends Pick<AtlasStructure, "risk">>(items: T[]): T[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => RISKS[a.item.risk].rank - RISKS[b.item.risk].rank || a.index - b.index)
    .map(({ item }) => item);
}

/** Text toggle in the sheet's language: underlined when on. */
export function textToggleClass(on: boolean): string {
  return `whitespace-nowrap text-[13px] underline-offset-[6px] transition ${
    on
      ? "font-semibold text-inkdeep underline decoration-inkdeep decoration-[1.5px]"
      : "text-ink/65 hover:text-ink hover:underline hover:decoration-ink/30"
  }`;
}
