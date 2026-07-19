import { getAnthropicClient, isFakeMode, MID_MODEL } from "./client";
import { stripDecorations } from "../codex/decorations";

// Turn a note into spaced-repetition flashcards. This is structured
// extraction over content the doctor already curated, so it runs on the
// mid-tier model (Sonnet) — good judgement about what's worth testing, at a
// fraction of Opus cost. Cards test the load-bearing facts (doses,
// parameters, thresholds, step sequences, contraindications), not trivia.

export interface GeneratedCard {
  front: string;
  back: string;
}

export interface FlashcardInput {
  title: string;
  content: string;
}

export type FlashcardCaller = (input: FlashcardInput) => Promise<GeneratedCard[]>;

export function buildFlashcardPrompt(input: FlashcardInput): string {
  return `아래는 미용의학 전공의의 지식 노트입니다. 이 노트로 **능동 회상(active recall) 학습용 플래시카드**를 만들어 주세요.

원칙:
- **시험에 나올 만한, 임상에서 실제로 기억해야 하는 핵심만** 카드로. 파라미터·용량·간격·역치·금기·단계 순서·감별점 위주.
- 한 카드 = 하나의 사실. front(질문)는 구체적으로, back(답)은 **원문의 수치를 그대로** 담아 간결하게.
- 신변잡기·배경 설명·일반 상식은 카드로 만들지 마세요.
- 한글+영어 혼용은 노트 스타일 그대로 유지.
- 노트 분량에 맞게 **3~8장** 정도. 억지로 채우지 마세요 — 정말 외울 가치가 있는 것만.

예시 형식:
- front: "필러 혈관 폐색(VO) 의심 시 hyaluronidase 국소 주입 용량은?"
- back: "200-300 IU 국소 주입, 필요 시 반복"

제목: ${input.title}

노트 본문:
${stripDecorations(input.content).slice(0, 6000)}`;
}

const CARDS_SCHEMA = {
  type: "object",
  properties: {
    cards: {
      type: "array",
      items: {
        type: "object",
        properties: {
          front: { type: "string" },
          back: { type: "string" },
        },
        required: ["front", "back"],
        additionalProperties: false,
      },
    },
  },
  required: ["cards"],
  additionalProperties: false,
} as const;

export const anthropicFlashcardCaller: FlashcardCaller = async (input) => {
  const client = getAnthropicClient();
  // Sonnet runs adaptive thinking by default; no `thinking` param needed.
  const response = await client.messages.create({
    model: MID_MODEL,
    max_tokens: 4000,
    output_config: { format: { type: "json_schema", schema: CARDS_SCHEMA } },
    messages: [{ role: "user", content: buildFlashcardPrompt(input) }],
  });

  if (response.stop_reason === "refusal") return [];
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") return [];

  const parsed = JSON.parse(textBlock.text) as { cards: GeneratedCard[] };
  return parsed.cards
    .map((c) => ({ front: c.front.trim(), back: c.back.trim() }))
    .filter((c) => c.front.length > 0 && c.back.length > 0);
};

/** Deterministic offline cards for CODEX_AI_MODE=fake. */
export const fakeFlashcardCaller: FlashcardCaller = async (input) => {
  const plain = stripDecorations(input.content).replace(/\s+/g, " ").trim();
  return [
    { front: `[FAKE] "${input.title}"의 핵심 요지는?`, back: plain.slice(0, 160) || "내용 없음" },
    { front: `[FAKE] "${input.title}" 관련 기억할 수치/파라미터는?`, back: "실제 모드에서 원문 수치가 카드로 추출됩니다." },
  ];
};

export function defaultFlashcardCaller(): FlashcardCaller {
  return isFakeMode() ? fakeFlashcardCaller : anthropicFlashcardCaller;
}
