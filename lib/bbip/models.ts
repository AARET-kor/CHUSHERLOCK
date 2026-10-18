import { MID_MODEL, MODEL } from "../ai/client";
import { getSection } from "./sections";
import type { TurnRequest } from "./types";

export type Effort = "low" | "medium" | "high";

function parseEffort(value: string | undefined, fallback: Effort): Effort {
  return value === "low" || value === "medium" || value === "high" ? value : fallback;
}

/** The brief must appear fast: Opus at low effort by default. */
export const BRIEF_MODEL = process.env.BBIP_BRIEF_MODEL ?? MODEL;
export const BRIEF_EFFORT: Effort = parseEffort(process.env.BBIP_BRIEF_EFFORT, "low");

/** Server-side refusal fallback, "default" form: the API picks the fallback
 * model by refusal category, so there is no model list to maintain. */
export const FALLBACK_BETA = "server-side-fallback-2026-07-01";

/** Opus 5.x and Sonnet 5.5 on the first-party API accept `fallbacks:
 * "default"`. Provider-prefixed ids (Bedrock "anthropic.…") do not match. */
export function usesServerFallback(model: string): boolean {
  return /^claude-(opus-5|sonnet-5-5)/.test(model);
}

/** `output_config.effort` errors on Haiku 4.5 / Sonnet 4.5 and older, so env
 * overrides to those models must not send it. */
export function supportsEffort(model: string): boolean {
  return !/(?:^|[./])claude-(?:3[-.]|haiku-4|sonnet-4(?:-[05]|-\d{8}|@|$)|opus-4(?:-[01]|-\d{8}|@|$))/.test(model);
}

export interface ModelChoice {
  model: string;
  effort: Effort;
}

export function modelForRequest(request: TurnRequest): ModelChoice {
  if (request.kind === "brief") return { model: BRIEF_MODEL, effort: BRIEF_EFFORT };
  if (request.kind === "section" && request.sectionKey) {
    const tier = getSection(request.sectionKey).tier;
    return { model: tier === "opus" ? MODEL : MID_MODEL, effort: "medium" };
  }
  return { model: MODEL, effort: "medium" };
}
