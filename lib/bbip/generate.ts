import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient, isFakeMode } from "../ai/client";
import type { CodexEntry } from "../codex/types";
import { buildTurnContext, type TurnContext } from "./context";
import { FALLBACK_BETA, modelForRequest, supportsEffort, usesServerFallback, type ModelChoice } from "./models";
import { anatomyPlanFor, regionStructures } from "./anatomy/regions";
import { turnTitle } from "./sections";
import type { BbipSession, BbipTurn, TurnRequest } from "./types";

/** What actually ran: with server-side fallback the serving model can differ
 * from the requested one. Reported once the stream has finished. */
export interface TurnFinalInfo {
  model: string;
  stopReason: string | null;
}

export interface GenerateArgs {
  session: BbipSession;
  entries: CodexEntry[];
  priorTurns: BbipTurn[];
  request: TurnRequest;
  onFinal?: (info: TurnFinalInfo) => void;
}

const REFUSAL_NOTE =
  "\n\n> **주의** 이 요청은 안전 정책으로 답변이 중단되었습니다. 질문을 바꿔 다시 시도해 주세요.";
const TRUNCATED_NOTE = "\n\n> **주의** 답변이 길이 제한으로 잘렸습니다.";

/** Thrown after the refusal note was streamed, so the turn is stored as
 * failed rather than as a normal answer. */
export class RefusalError extends Error {
  constructor(message = "refusal") {
    super(message);
    this.name = "RefusalError";
  }
}

/** Thrown after the truncation note was streamed (stop_reason
 * "max_tokens"): a cut-off card must not be promoted or reused as context. */
export class TruncatedError extends Error {
  constructor(message = "truncated") {
    super(message);
    this.name = "TruncatedError";
  }
}

/** Deterministic text for CODEX_AI_MODE=fake — exercises markers and the
 * followups tag so the whole pipeline runs offline. */
export function fakeTurnText(args: GenerateArgs): string {
  const { session, request } = args;
  const cite = session.sourceNoteIds.length > 0 ? "[1]" : "[AI]";
  const proc = session.chips.procedures[0] ?? "시술";
  if (request.kind === "brief") {
    const flagLine = session.flags[0]
      ? `- !!${session.flags[0].text}!! [AI]`
      : "- 특이 금기·주의 없음 [AI]";
    const followups = JSON.stringify([`${proc} 감별 포인트는?`, `${proc} 시술 간격은?`, "재발 시 설명 멘트"]);
    const plan = anatomyPlanFor(session.chips);
    const structures = plan ? plan.regions.flatMap((key) => regionStructures(key, plan)) : [];
    const watch = structures.find((s) => s.layer === "arteries") ?? structures.find((s) => s.layer !== "entry");
    return [
      "- **[FAKE 모드]** 핵심 브리핑 예시입니다.",
      flagLine,
      `- ${proc}: 실제 모드에서는 ==노트 근거 팁==이 표시됩니다 ${cite}`,
      ...(watch ? [`- 주의 구조물: {{atlas:${watch.id}}} [AI]`] : []),
      "- 회차·업셀 제안이 여기에 표시됩니다 [AI]",
      `<followups>${followups}</followups>`,
    ].join("\n");
  }
  if (request.kind === "literature") {
    const paper = session.literature?.papers.length ? "[P1]" : "[AI]";
    const web = session.literature?.web.length ? "[W1]" : "[AI]";
    return [
      "## 문헌 근거 (FAKE)",
      `- ${proc} 관련 예시 문헌 요약입니다 ${paper}`,
      `- 허가사항·가이드라인 예시입니다 ${web}`,
      "- 실제 모드에서는 근거수준 순으로 정리됩니다 [AI]",
    ].join("\n");
  }
  return [
    `## ${turnTitle(request)} (FAKE)`,
    `- ${proc} 관련 예시 내용입니다 ${cite}`,
    "- 실제 모드에서는 이 자리에 상세 답변이 스트리밍됩니다 [AI]",
  ].join("\n");
}

type StreamParams = Parameters<Anthropic["beta"]["messages"]["stream"]>[0];

// SDK 0.110 types `fallbacks` only as the array form; the API also accepts
// the scalar "default" form (with FALLBACK_BETA). Cast just this one value.
const DEFAULT_FALLBACKS = "default" as unknown as Anthropic.Beta.BetaFallbackParam[];

export function buildStreamParams(
  args: GenerateArgs,
  context: Pick<TurnContext, "system" | "messages">,
  { model, effort }: ModelChoice
): StreamParams {
  return {
    model,
    max_tokens: args.request.kind === "brief" ? 8000 : 32000,
    ...(supportsEffort(model) ? { output_config: { effort } } : {}),
    ...(usesServerFallback(model) ? { betas: [FALLBACK_BETA], fallbacks: DEFAULT_FALLBACKS } : {}),
    system: context.system,
    messages: context.messages,
  };
}

/** The slice of the SDK's BetaMessageStream this module uses (injectable in tests). */
export interface TurnStream extends AsyncIterable<Anthropic.Beta.BetaRawMessageStreamEvent> {
  finalMessage(): Promise<Pick<Anthropic.Beta.BetaMessage, "model" | "stop_reason">>;
}

export type OpenTurnStream = (params: StreamParams) => TurnStream;

const openAnthropicStream: OpenTurnStream = (params) => getAnthropicClient().beta.messages.stream(params);

export async function* streamTurnText(
  args: GenerateArgs,
  open: OpenTurnStream = openAnthropicStream
): AsyncGenerator<string> {
  const choice = modelForRequest(args.request);
  const stream = open(buildStreamParams(args, buildTurnContext(args), choice));
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield event.delta.text;
    }
  }
  const final = await stream.finalMessage();
  args.onFinal?.({ model: final.model, stopReason: final.stop_reason });
  if (final.stop_reason === "refusal") {
    yield REFUSAL_NOTE;
    throw new RefusalError("refusal");
  }
  if (final.stop_reason === "max_tokens") {
    yield TRUNCATED_NOTE;
    throw new TruncatedError("truncated");
  }
}

export async function* generateTurnText(args: GenerateArgs): AsyncGenerator<string> {
  if (isFakeMode()) {
    // Exercise prompt/context assembly offline; the result is not sent.
    buildTurnContext(args);
    const text = fakeTurnText(args);
    for (let i = 0; i < text.length; i += 24) yield text.slice(i, i + 24);
    args.onFinal?.({ model: "fake", stopReason: "end_turn" });
    return;
  }
  yield* streamTurnText(args);
}
