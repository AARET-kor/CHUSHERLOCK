import Anthropic from "@anthropic-ai/sdk";

// Main model: reads documents and writes the actual notes — quality matters
// most here, so it stays on Opus unless overridden.
export const MODEL = process.env.CODEX_AI_MODEL ?? "claude-opus-4-8";

// Light model for mechanical subtasks — verbatim OCR transcription and
// relatedness screening. Haiku 4.5 runs these at ~1/5 the per-token price
// with no meaningful quality loss (transcribe-what-you-see / yes-no
// matching). NOTE: Haiku 4.5 does not support adaptive thinking — calls
// using LIGHT_MODEL must not send a `thinking` parameter.
export const LIGHT_MODEL = process.env.CODEX_AI_MODEL_LIGHT ?? "claude-haiku-4-5";

export function isFakeMode(): boolean {
  return process.env.CODEX_AI_MODE === "fake";
}

let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}
