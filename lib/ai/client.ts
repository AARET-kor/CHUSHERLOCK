import Anthropic from "@anthropic-ai/sdk";

// Three-tier model split — each call goes to the cheapest model that does
// the job well:
//
//   Opus   (MODEL)       reading chunks + writing the actual notes.
//                        Quality-critical: this is the product.
//   Sonnet (MID_MODEL)   structured judgement over many items — figure
//                        bbox detection (vision) and the learning-cluster
//                        pass. Near-Opus quality here at ~60% of the price.
//   Haiku  (LIGHT_MODEL) mechanical subtasks — verbatim OCR transcription,
//                        relatedness screening. ~1/5 the per-token price,
//                        and no thinking tokens at all.
//
// NOTE: Haiku 4.5 does not support adaptive thinking, and Sonnet 5 runs
// adaptive by default — so MID/LIGHT calls simply omit the `thinking`
// parameter and stay valid whatever model the env vars point at.
export const MODEL = process.env.CODEX_AI_MODEL ?? "claude-opus-4-8";
export const MID_MODEL = process.env.CODEX_AI_MODEL_MID ?? "claude-sonnet-5";
export const LIGHT_MODEL = process.env.CODEX_AI_MODEL_LIGHT ?? "claude-haiku-4-5";

export function isFakeMode(): boolean {
  return process.env.CODEX_AI_MODE === "fake";
}

let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}
