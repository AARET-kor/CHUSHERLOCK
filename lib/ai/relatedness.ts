import { getAnthropicClient, isFakeMode, LIGHT_MODEL } from "./client";

// Semantic overlap detection: given a new note and existing same-category
// notes, ask the model which existing notes genuinely cover the same topic
// (so they should be interlinked rather than duplicated). This replaces the
// title-token Jaccard heuristic as the primary linker; the heuristic remains
// as the instant in-form preview and as the fallback when no model is
// available.

export interface RelatednessCandidate {
  id: string;
  title: string;
  excerpt: string;
}

export interface RelatednessInput {
  newNote: { title: string; content: string; categoryLabel: string };
  candidates: RelatednessCandidate[];
}

export type RelatednessCaller = (input: RelatednessInput) => Promise<string[]>;

export function buildRelatednessPrompt(input: RelatednessInput): string {
  const candidateList = input.candidates
    .map((c) => `<note id="${c.id}">\n제목: ${c.title}\n내용 일부: ${c.excerpt}\n</note>`)
    .join("\n");

  return `미용의학 지식 베이스에 새 노트를 저장하려고 합니다. 아래 기존 노트들 중, 새 노트와 **실질적으로 같은 주제를 다루거나 내용이 겹치는** 노트만 골라 주세요. 겹치는 노트는 서로 "관련 노트"로 연결되어 중복 대신 자연스럽게 overlap 됩니다.

판단 기준:
- 같은 시술/합병증/해부 구조/개념을 다루면 관련 있음 (관점이나 깊이가 달라도 됨).
- 단지 같은 카테고리라는 이유만으로는 관련 없음.
- 확실하지 않으면 제외하세요. 잘못 연결하는 것보다 빠뜨리는 것이 낫습니다.

<new_note>
카테고리: ${input.newNote.categoryLabel}
제목: ${input.newNote.title}
내용:
${input.newNote.content.slice(0, 1200)}
</new_note>

<existing_notes>
${candidateList}
</existing_notes>`;
}

export const anthropicRelatednessCaller: RelatednessCaller = async (input) => {
  if (input.candidates.length === 0) return [];
  const client = getAnthropicClient();
  const candidateIds = input.candidates.map((c) => c.id);

  // Yes/no topic matching is light-model work — no `thinking` param
  // (unsupported on Haiku, and unneeded), 1/5 the per-token price.
  const response = await client.messages.create({
    model: LIGHT_MODEL,
    max_tokens: 2000,
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            related: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string", enum: candidateIds },
                  reason: { type: "string" },
                },
                required: ["id", "reason"],
                additionalProperties: false,
              },
            },
          },
          required: ["related"],
          additionalProperties: false,
        },
      },
    },
    messages: [{ role: "user", content: buildRelatednessPrompt(input) }],
  });

  if (response.stop_reason === "refusal") return [];
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") return [];

  const parsed = JSON.parse(textBlock.text) as { related: Array<{ id: string }> };
  const validIds = new Set(candidateIds);
  return parsed.related.map((r) => r.id).filter((id) => validIds.has(id));
};

/** Offline mode: no semantic judgement — heuristic links (computed by the
 * caller) stand alone. */
export const fakeRelatednessCaller: RelatednessCaller = async () => [];

export function defaultRelatednessCaller(): RelatednessCaller {
  return isFakeMode() ? fakeRelatednessCaller : anthropicRelatednessCaller;
}

/**
 * Returns the candidate IDs the model judges to be genuinely the same topic.
 * Never throws: on any failure (no API key, network, refusal) it returns []
 * so entry saving degrades to the title heuristic instead of breaking.
 */
export async function findSemanticRelatedIds(
  input: RelatednessInput,
  caller: RelatednessCaller = defaultRelatednessCaller()
): Promise<string[]> {
  if (input.candidates.length === 0) return [];
  try {
    return await caller(input);
  } catch (error) {
    console.warn(
      "[relatedness] semantic check failed, falling back to title heuristic:",
      error instanceof Error ? error.message : error
    );
    return [];
  }
}
