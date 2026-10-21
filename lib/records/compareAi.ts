// lib/records/compareAi.ts
// AI change analysis: two photos of the same angle + the course's clinical
// facts → a short Korean description of visible change. Runs only when the
// doctor presses the button and confirms what is sent.
import type Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";
import { getAnthropicClient, MID_MODEL } from "../ai/client";
import { FALLBACK_BETA, supportsEffort, usesServerFallback } from "../bbip/models";

export const COMPARE_MODEL = process.env.BBIP_COMPARE_MODEL ?? MID_MODEL;

export class CompareError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CompareError";
  }
}

type StreamParams = Parameters<Anthropic["beta"]["messages"]["stream"]>[0];

// SDK 0.110 types `fallbacks` only as the array form; the API also accepts
// "default" (with FALLBACK_BETA). Same cast as lib/bbip/generate.ts.
const DEFAULT_FALLBACKS = "default" as unknown as Anthropic.Beta.BetaFallbackParam[];

/** Long edge ≤ 1024 px, JPEG, no metadata — enough to see skin change,
 * and far fewer image tokens than the stored 2400 px original. */
export async function imageForAi(input: Buffer): Promise<string> {
  const out = await sharp(input)
    .rotate()
    .resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
  return out.toString("base64");
}

const SYSTEM = `당신은 한국 미용 GP 원장의 시술 경과 비교를 돕습니다. 같은 각도에서 찍은 시술 전후 사진 2장과 시술 정보가 주어집니다.
- 사진에서 보이는 변화만 객관적으로 씁니다: 색소·홍반·주름·볼륨·윤곽·피부결 중 해당하는 것.
- 촬영 조건 차이(조명, 거리, 각도, 표정, 화장)가 판단을 흐리면 먼저 밝힙니다.
- 확실하지 않은 변화는 "불확실"로 표시하고 과장하지 않습니다.
- 진단·처방·다음 회차 파라미터는 제안하지 않습니다.
- 형식: 첫 줄에 한 문장 요약, 이어서 짧은 불릿 3~6개. 서론·맺음말 없이.
- 사람을 식별하려 하지 않습니다.`;

export function buildCompareParams(
  input: { facts: string; before: string; after: string },
  model: string = COMPARE_MODEL
): StreamParams {
  return {
    model,
    max_tokens: 4000,
    ...(supportsEffort(model) ? { output_config: { effort: "medium" as const } } : {}),
    ...(usesServerFallback(model) ? { betas: [FALLBACK_BETA], fallbacks: DEFAULT_FALLBACKS } : {}),
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "이전 사진:" },
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: input.before } },
          { type: "text", text: "이후 사진:" },
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: input.after } },
          { type: "text", text: `시술 정보:\n${input.facts}\n\n두 사진 사이의 변화를 정리해 주세요.` },
        ],
      },
    ],
  };
}

export interface CompareCallResult {
  text: string;
  model: string;
  stopReason: string | null;
}

export type CompareCaller = (params: StreamParams) => Promise<CompareCallResult>;

export const anthropicCompareCaller: CompareCaller = async (params) => {
  const message = await getAnthropicClient().beta.messages.stream(params).finalMessage();
  const text = message.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("");
  return { text, model: message.model, stopReason: message.stop_reason };
};

export async function callCompareModel(
  params: StreamParams,
  caller: CompareCaller = anthropicCompareCaller
): Promise<{ text: string; model: string }> {
  const result = await caller(params);
  if (result.stopReason === "refusal") throw new CompareError("안전 정책으로 분석이 중단되었습니다.");
  if (result.stopReason === "max_tokens") throw new CompareError("분석이 길이 제한으로 잘렸습니다.");
  const text = result.text.trim();
  if (!text) throw new CompareError("분석 결과가 비어 있습니다.");
  return { text, model: result.model };
}

/** CODEX_AI_MODE=fake: a fixed draft so the flow runs offline. */
export function fakeCompareText(): string {
  return [
    "[FAKE] 이전보다 색소가 옅어진 것으로 보입니다.",
    "- 광대 부위 갈색 반점 대비가 줄었습니다",
    "- 홍반 변화는 불확실합니다",
    "- 두 사진의 조명 밝기가 달라 비교에 주의가 필요합니다",
  ].join("\n");
}
