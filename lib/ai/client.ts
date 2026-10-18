import Anthropic from "@anthropic-ai/sdk";

// Three-tier model split — each call goes to the cheapest model that does
// the job well:
//
//   Opus   (MODEL)       reading chunks + writing the actual notes, BBIP
//                        brief and safety sections. Quality-critical.
//   Sonnet (MID_MODEL)   structured judgement over many items — figure
//                        bbox detection, learning clusters, BBIP practice/
//                        business sections.
//   Haiku  (LIGHT_MODEL) mechanical subtasks — OCR transcription,
//                        relatedness screening, BBIP case parsing.
//
// NOTE: the 5.5 models run adaptive thinking by default, so MID/LIGHT calls
// omit the `thinking` parameter and stay valid whatever model the env vars
// point at.
export const MODEL = process.env.CODEX_AI_MODEL ?? "claude-opus-5-5";
export const MID_MODEL = process.env.CODEX_AI_MODEL_MID ?? "claude-sonnet-5-5";
export const LIGHT_MODEL = process.env.CODEX_AI_MODEL_LIGHT ?? "claude-haiku-5-5";

export function isFakeMode(): boolean {
  return process.env.CODEX_AI_MODE === "fake";
}

let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}
