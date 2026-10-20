import { DEPTHS, RISKS } from "./layers";
import { getRegion, regionStructures, type AnatomyPlan } from "./regions";
import type { AtlasStructure } from "./atlas";

const DEPTH_KO = new Map(DEPTHS.map((d) => [d.key, d.ko]));

function structureLine(s: AtlasStructure): string {
  const depth = s.depths.map((d) => DEPTH_KO.get(d)).join("→");
  return `- ${s.id} · ${s.ko} (${s.en}) · 위험 ${RISKS[s.risk].ko} · ${depth} · ${s.riskNote}`;
}

/** The case regions' atlas structures for the prompt: names, depth and risk
 * only — never coordinates. Deterministic for a session (cache block ②). */
export function buildAtlasBlock(plan: AnatomyPlan | null): string {
  if (!plan) return "";
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const key of plan.regions) {
    for (const s of regionStructures(key, plan)) {
      if (s.layer === "entry" || seen.has(s.id)) continue;
      seen.add(s.id);
      lines.push(structureLine(s));
    }
  }
  const regions = plan.regions.map((key) => `${getRegion(key).ko}(${key})`).join(", ");
  return [
    "<atlas>",
    `이번 케이스 시술 부위의 해부 구조물 — BBIP 아틀라스(원장 검토 전 초안 포함). 부위: ${regions}`,
    ...(plan.regionsGuessed
      ? ["부위 미확인: 케이스에 시술 부위가 없어 이 시술의 흔한 부위를 모두 넣었습니다. 특정 부위로 단정하지 말고, 필요하면 부위를 확인하라고 쓰세요."]
      : []),
    ...lines,
    "",
    "규칙: 위 구조물을 언급할 때는 {{atlas:id}} 형식으로 쓰세요(예: {{atlas:" +
      (lines.length ? [...seen][0] : "angular-artery") +
      "}}). 목록에 없는 구조물의 위치·주행·깊이는 지어내지 말고 \"아틀라스에 없음 — 확인 필요\"라고 쓰세요. 좌표나 거리 수치를 새로 만들지 마세요.",
    "</atlas>",
  ].join("\n");
}
