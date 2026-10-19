// Shared vocabulary for the BBIP anatomy map. Framework-free; colors are
// plain hex so SVG can use them directly.

export type ViewKey = "front" | "oblique" | "lateral";
export const VIEWS: { key: ViewKey; ko: string; en: string }[] = [
  { key: "front", ko: "정면", en: "Front" },
  { key: "oblique", ko: "45°", en: "Oblique" },
  { key: "lateral", ko: "측면", en: "Lateral" },
];

export type LayerKey =
  | "arteries" | "veins" | "nerves" | "ducts" | "muscles" | "fat" | "ligaments" | "danger" | "entry";

export interface LayerDef {
  key: LayerKey;
  ko: string;
  en: string;
  /** Anatomical convention — red arteries, blue veins, yellow nerves. */
  color: string;
  /** Outline drawn under lines so light colors (yellow) stay legible on white. */
  casing: string;
}

export const LAYERS: LayerDef[] = [
  { key: "arteries", ko: "동맥", en: "Arteries", color: "#e0262c", casing: "#ffffff" },
  { key: "veins", ko: "정맥", en: "Veins", color: "#2563eb", casing: "#ffffff" },
  { key: "nerves", ko: "신경", en: "Nerves", color: "#f5b800", casing: "#7a5600" },
  { key: "ducts", ko: "관", en: "Ducts", color: "#0e9384", casing: "#ffffff" },
  { key: "muscles", ko: "근육", en: "Muscles", color: "#c0605c", casing: "#ffffff" },
  { key: "fat", ko: "지방구획", en: "Fat compartments", color: "#c99a4f", casing: "#ffffff" },
  { key: "ligaments", ko: "인대", en: "Ligaments", color: "#6b7c86", casing: "#ffffff" },
  { key: "danger", ko: "위험구역", en: "Danger zones", color: "#e0262c", casing: "#ffffff" },
  { key: "entry", ko: "진입점·벡터", en: "Entry points", color: "#051a24", casing: "#ffffff" },
];

/** Layers whose lines carry something along them (blood, signal, saliva) —
 * these animate a flow when focused. */
export const FLOWING_LAYERS: ReadonlySet<LayerKey> = new Set(["arteries", "veins", "nerves", "ducts"]);

/** What "흐름" means per layer, for the detail panel. */
export const FLOW_LABELS: Partial<Record<LayerKey, string>> = {
  arteries: "혈류 방향",
  veins: "배액 방향",
  nerves: "분포 방향",
  ducts: "분비 방향",
};

/** Superficial → deep. */
export type DepthKey = "skin" | "subcutaneous" | "smas" | "deep-fat" | "periosteum";
export const DEPTHS: { key: DepthKey; ko: string; en: string }[] = [
  { key: "skin", ko: "피부(진피)", en: "Skin / dermis" },
  { key: "subcutaneous", ko: "피하지방", en: "Subcutaneous fat" },
  { key: "smas", ko: "SMAS·근육", en: "SMAS / muscle" },
  { key: "deep-fat", ko: "심부지방·근하층", en: "Deep fat / sub-SMAS" },
  { key: "periosteum", ko: "골막", en: "Periosteum" },
];

export type RiskLevel = "critical" | "high" | "moderate" | "low";
export const RISKS: Record<RiskLevel, { ko: string; rank: number }> = {
  critical: { ko: "매우 높음", rank: 0 },
  high: { ko: "높음", rank: 1 },
  moderate: { ko: "중간", rank: 2 },
  low: { ko: "낮음", rank: 3 },
};

export type ProcedureCategory =
  | "face-filler" | "filler-dissolving" | "collagen-stimulator" | "thread-lifting" | "skin-booster" | "botox";
export const PROCEDURE_CATEGORIES: ProcedureCategory[] = [
  "face-filler", "filler-dissolving", "collagen-stimulator", "thread-lifting", "skin-booster", "botox",
];
export const CATEGORY_LABELS: Record<ProcedureCategory, string> = {
  "face-filler": "필러",
  "filler-dissolving": "필러 용해",
  "collagen-stimulator": "콜라겐 자극제",
  "thread-lifting": "실리프팅",
  "skin-booster": "스킨부스터",
  botox: "보톡스",
};
