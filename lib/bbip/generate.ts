import { getAnthropicClient, isFakeMode } from "../ai/client";
import type { CodexEntry } from "../codex/types";
import { buildTurnContext } from "./context";
import { FALLBACK_BETA, FALLBACK_MODEL, isOpus, modelForRequest, supportsEffort } from "./models";
import { turnTitle } from "./sections";
import type { BbipSession, BbipTurn, TurnRequest } from "./types";

export interface GenerateArgs {
  session: BbipSession;
  entries: CodexEntry[];
  priorTurns: BbipTurn[];
  request: TurnRequest;
}

const REFUSAL_NOTE =
  "\n\n> **주의** 이 요청은 안전 정책으로 답변이 중단되었습니다. 질문을 바꿔 다시 시도해 주세요.";

/** Deterministic text for CODEX_AI_MODE=fake — exercises markers and the
 * followups tag so the whole pipeline runs offline. */
export function fakeTurnText(args: GenerateArgs): string {
  const { session, request } = args;
  const cite = session.sourceNoteIds.length > 0 ? "[1]" : "[AI]";
  const proc = session.chips.procedures[0] ?? "시술";
  if (request.kind === "brief") {
    const flagLine = session.flags[0]
      ? `- ${session.flags[0].text} [AI]`
      : "- 특이 금기·주의 없음 [AI]";
    const followups = JSON.stringify([`${proc} 감별 포인트는?`, `${proc} 시술 간격은?`, "재발 시 설명 멘트"]);
    return [
      "- **[FAKE 모드]** 핵심 브리핑 예시입니다.",
      flagLine,
      `- ${proc}: 실제 모드에서는 노트 근거 팁이 표시됩니다 ${cite}`,
      "- 회차·업셀 제안이 여기에 표시됩니다 [AI]",
      `<followups>${followups}</followups>`,
    ].join("\n");
  }
  return [
    `## ${turnTitle(request)} (FAKE)`,
    `- ${proc} 관련 예시 내용입니다 ${cite}`,
    "- 실제 모드에서는 이 자리에 상세 답변이 스트리밍됩니다 [AI]",
  ].join("\n");
}

export async function* generateTurnText(args: GenerateArgs): AsyncGenerator<string> {
  if (isFakeMode()) {
    const text = fakeTurnText(args);
    for (let i = 0; i < text.length; i += 24) yield text.slice(i, i + 24);
    return;
  }

  const { model, effort } = modelForRequest(args.request);
  const context = buildTurnContext(args);
  const withFallback = isOpus(model) && model !== FALLBACK_MODEL;
  const stream = getAnthropicClient().beta.messages.stream({
    model,
    max_tokens: args.request.kind === "brief" ? 8000 : 32000,
    ...(supportsEffort(model) ? { output_config: { effort } } : {}),
    ...(withFallback ? { betas: [FALLBACK_BETA], fallbacks: [{ model: FALLBACK_MODEL }] } : {}),
    system: context.system,
    messages: context.messages,
  });

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield event.delta.text;
    }
  }
  const final = await stream.finalMessage();
  if (final.stop_reason === "refusal") yield REFUSAL_NOTE;
}
