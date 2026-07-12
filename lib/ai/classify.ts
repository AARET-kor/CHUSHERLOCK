import { getLeafCategories } from "../codex/taxonomy";
import { chunkDocument } from "../ingest/chunk";
import { getAnthropicClient, isFakeMode, MODEL } from "./client";
import {
  buildSystemPrompt,
  buildJobPrefix,
  buildChunkTurn,
  type ChunkPromptInput,
} from "./prompts";
import {
  chunkResultSchema,
  buildChunkResultJsonSchema,
  type ChunkResult,
  type SuggestedEntry,
} from "./schemas";

/** One model round-trip for one chunk. Injectable so tests and the local
 * fake mode can run the full pipeline without API calls. */
export type ChunkCaller = (input: ChunkPromptInput) => Promise<ChunkResult>;

export const anthropicChunkCaller: ChunkCaller = async (input) => {
  const client = getAnthropicClient();
  const leafKeys = getLeafCategories().map((c) => c.key);
  const figureIds = (input.figures ?? []).map((f) => f.id);

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 32000,
    thinking: { type: "adaptive" },
    system: [
      {
        type: "text",
        text: buildSystemPrompt(),
        cache_control: { type: "ephemeral" },
      },
    ],
    output_config: {
      format: {
        type: "json_schema",
        schema: buildChunkResultJsonSchema(leafKeys, figureIds),
      },
    },
    messages: [
      {
        role: "user",
        content: [
          {
            // Job-stable prefix (metadata + figure list): identical for every
            // chunk of one job, so chunks 2..N read it from cache instead of
            // re-paying for it. The volatile part goes after the breakpoint.
            type: "text",
            text: buildJobPrefix(input),
            cache_control: { type: "ephemeral" },
          },
          { type: "text", text: buildChunkTurn(input) },
        ],
      },
    ],
  });

  const message = await stream.finalMessage();

  if (message.stop_reason === "refusal") {
    throw new Error("모델이 이 내용의 처리를 거부했습니다 (safety refusal).");
  }
  if (message.stop_reason === "max_tokens") {
    throw new Error(
      "모델 출력이 잘렸습니다. 청크 크기를 줄이거나 다시 시도해 주세요."
    );
  }

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("모델 응답에서 텍스트를 찾지 못했습니다.");
  }

  const result = chunkResultSchema.parse(JSON.parse(textBlock.text));
  // Belt-and-suspenders: only keep figure ids that actually exist.
  const validFigureIds = new Set(figureIds);
  for (const entry of result.entries) {
    entry.figureIds = entry.figureIds.filter((figureId) => validFigureIds.has(figureId));
  }
  return result;
};

/** Deterministic offline caller (CODEX_AI_MODE=fake): lets the whole
 * upload → progress → review → save flow run without an API key. */
export const fakeChunkCaller: ChunkCaller = async (input) => {
  const firstLine = input.chunkText.split("\n").find((l) => l.trim()) ?? "내용";
  const leafKeys = getLeafCategories().map((c) => c.key);
  return {
    entries: [
      {
        title: `[FAKE] ${firstLine.slice(0, 60)}`,
        categoryKey: leafKeys[input.chunkIndex % leafKeys.length]!,
        tier: "deep_study",
        tags: ["fake-mode"],
        content: `> **한눈에 보기**\n> 오프라인 fake 모드로 생성된 노트입니다.\n> 실제 모드에서는 이 자리에 쉬운 3-4줄 요약이 들어갑니다.\n\n${input.chunkText.slice(0, 1500)}`,
        sourceLocation: `chunk ${input.chunkIndex + 1}`,
        figureIds: (input.figures ?? []).map((f) => f.id),
      },
    ],
    contextSummary: `${input.contextSummary}\nchunk ${input.chunkIndex + 1} 처리됨.`.trim(),
  };
};

export function defaultChunkCaller(): ChunkCaller {
  return isFakeMode() ? fakeChunkCaller : anthropicChunkCaller;
}

export interface ProcessDocumentInput {
  text: string;
  sourceLabel: string;
  sourceCitation: string;
  formatNote: string;
  figures?: import("./prompts").PromptFigure[];
}

export interface ProcessDocumentResult {
  suggestions: SuggestedEntry[];
  chunkCount: number;
}

/**
 * Reads a document front-to-back: chunks it at natural boundaries, then runs
 * each chunk through the model in order, carrying a rolling context summary
 * so classification decisions see the document's overall flow — not just the
 * local text. Returns the concatenated entry suggestions in document order.
 */
export async function processDocument(
  input: ProcessDocumentInput,
  options: {
    caller?: ChunkCaller;
    onProgress?: (processed: number, total: number) => void | Promise<void>;
  } = {}
): Promise<ProcessDocumentResult> {
  const caller = options.caller ?? defaultChunkCaller();
  const chunks = chunkDocument(input.text);
  if (chunks.length === 0) throw new Error("문서에서 텍스트를 찾지 못했습니다.");

  const suggestions: SuggestedEntry[] = [];
  let contextSummary = "";

  for (let i = 0; i < chunks.length; i++) {
    const result = await caller({
      sourceLabel: input.sourceLabel,
      sourceCitation: input.sourceCitation,
      formatNote: input.formatNote,
      chunkIndex: i,
      totalChunks: chunks.length,
      contextSummary,
      chunkText: chunks[i]!,
      figures: input.figures,
    });
    suggestions.push(...result.entries);
    // Hard cap: the rolling summary feeds every later chunk's prompt, so a
    // runaway summary compounds token cost across the whole document.
    contextSummary = result.contextSummary.slice(0, 3500);
    await options.onProgress?.(i + 1, chunks.length);
  }

  return { suggestions, chunkCount: chunks.length };
}
