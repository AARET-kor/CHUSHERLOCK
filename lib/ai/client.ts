import Anthropic from "@anthropic-ai/sdk";

export const MODEL = process.env.CODEX_AI_MODEL ?? "claude-opus-4-8";

export function isFakeMode(): boolean {
  return process.env.CODEX_AI_MODE === "fake";
}

let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}
