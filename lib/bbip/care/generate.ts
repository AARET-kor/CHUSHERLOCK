// lib/bbip/care/generate.ts
import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient, MODEL } from "../../ai/client";
import { FALLBACK_BETA, supportsEffort, usesServerFallback } from "../models";
import { CareGenerationError } from "./errors";
import { CARE_SCHEMA, type CareContext } from "./prompt";

/** Safety-relevant orders: Opus by default. */
export const CARE_MODEL = process.env.BBIP_CARE_MODEL ?? MODEL;

type StreamParams = Parameters<Anthropic["beta"]["messages"]["stream"]>[0];

// SDK 0.110 types `fallbacks` only as the array form; the API also accepts
// "default" (with FALLBACK_BETA). Same cast as lib/bbip/generate.ts.
const DEFAULT_FALLBACKS = "default" as unknown as Anthropic.Beta.BetaFallbackParam[];

export function buildCareParams(context: CareContext, model: string = CARE_MODEL): StreamParams {
  return {
    model,
    max_tokens: 16000,
    output_config: {
      ...(supportsEffort(model) ? { effort: "medium" as const } : {}),
      format: { type: "json_schema", schema: CARE_SCHEMA },
    },
    ...(usesServerFallback(model) ? { betas: [FALLBACK_BETA], fallbacks: DEFAULT_FALLBACKS } : {}),
    system: context.system,
    messages: context.messages,
  };
}

export interface CareCallResult {
  text: string;
  /** Model that actually served (fallback may switch it). */
  model: string;
  stopReason: string | null;
}

export type CareCaller = (params: StreamParams) => Promise<CareCallResult>;

/** Streams (no HTTP timeout on long JSON) and returns the final message. */
export const anthropicCareCaller: CareCaller = async (params) => {
  const message = await getAnthropicClient().beta.messages.stream(params).finalMessage();
  const text = message.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("");
  return { text, model: message.model, stopReason: message.stop_reason };
};

export async function callCareModel(context: CareContext, caller: CareCaller = anthropicCareCaller): Promise<CareCallResult> {
  const result = await caller(buildCareParams(context));
  if (result.stopReason === "refusal") throw new CareGenerationError("안전 정책으로 오더 작성이 중단되었습니다.");
  if (result.stopReason === "max_tokens") throw new CareGenerationError("오더가 길이 제한으로 잘렸습니다.");
  return result;
}

const BLANK = {
  drug: "", brand: "", form: "", dose: "", frequency: "", duration: "", purpose: "",
  material: "", method: "", interval: "", situation: "", signs: "", action: "", resolution: "",
  urgency: "", day: 0, when: "", checks: "", next: "", patientText: "", cite: "AI",
};

/** CODEX_AI_MODE=fake: a fixed four-row order (nothing extra when a set exists). */
export function fakeCareResponse(hasSet: boolean): string {
  if (hasSet) return JSON.stringify({ caution: "[FAKE] 내 세트 기준 — 조정 없음", items: [], remove: [] });
  return JSON.stringify({
    caution: "",
    items: [
      { ...BLANK, kind: "rx", drug: "mupirocin", brand: "[FAKE] 박트로반", form: "2% 연고", dose: "얇게 도포", frequency: "1일 3회", duration: "5일", purpose: "감염 예방", patientText: "세안 후 시술 부위에 얇게 바르세요." },
      { ...BLANK, kind: "dressing", material: "[FAKE] 재생크림", method: "세안 후 얇게", interval: "1일 2회", duration: "7일", patientText: "문지르지 말고 톡톡 두드려 바르세요." },
      { ...BLANK, kind: "contingency", situation: "HSV 재발 의심", signs: "수포·작열감", action: "항바이러스제 시작", resolution: "보통 1~2주 내 호전", urgency: "now", patientText: "물집이나 화끈거림이 생기면" },
      { ...BLANK, kind: "followup", day: 7, when: "D+7", checks: "홍반·색소 확인", next: "2회차 일정", patientText: "경과를 확인합니다." },
    ],
    remove: [],
  });
}
