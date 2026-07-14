import { getAnthropicClient, isFakeMode, MID_MODEL } from "./client";

// Learning-cluster pass: given the whole library (compact form), group the
// notes into coherent STUDY UNITS — each a small set of notes that are best
// learned together, in a sensible order, with a one-line rationale and a few
// follow-up topics. This is what turns a pile of notes into a connected
// organism the user can study chunk by chunk.
//
// Runs on the mid-tier model (Sonnet): it's structured judgement over many
// short items — near-Opus quality at a fraction of the cost, and far cheaper
// than re-reading full note bodies (we send compact digests, not full text).

export interface ClusterNoteDigest {
  id: string;
  title: string;
  categoryLabel: string;
  tier: string;
  /** The note's 한눈에 보기 summary, or a short excerpt — enough to judge
   * topical relatedness without shipping the whole body. */
  digest: string;
}

export interface ClusterResult {
  title: string;
  description: string;
  suggestions: string[];
  /** Note ids in recommended study order. */
  entryIds: string[];
}

export interface ClusterInput {
  notes: ClusterNoteDigest[];
}

export type ClusterCaller = (input: ClusterInput) => Promise<ClusterResult[]>;

export function buildClusterPrompt(input: ClusterInput): string {
  const noteList = input.notes
    .map(
      (n) =>
        `<note id="${n.id}">\n제목: ${n.title}\n분류: ${n.categoryLabel} · ${n.tier}\n요지: ${n.digest}\n</note>`
    )
    .join("\n");

  return `당신은 미용의학 전공의의 학습 설계자입니다. 아래는 지식 베이스에 정리된 노트 목록입니다. 이 노트들을 **함께 공부하면 좋은 "학습 묶음(cluster)"** 으로 묶어 주세요. 목표는 파편화된 노트들을 하나의 유기체처럼 연결해, 사용자가 덩어리 단위로 학습하게 하는 것입니다.

묶는 기준:
- 같은 시술/합병증/해부 구조/개념 계열을 이루는 노트들을 하나의 묶음으로.
- 각 묶음 안에서는 **학습 순서**가 자연스럽게 흐르도록 노트를 정렬 (기초·전제 → 핵심 술기 → 합병증·심화 순서 등).
- 한 노트는 가장 잘 맞는 한 묶음에만 넣으세요 (중복 배정 금지).
- 억지로 다 묶지 마세요. 정말 홀로 서는 노트는 굳이 묶음에 넣지 않아도 됩니다(그런 노트는 어떤 묶음에도 넣지 않으면 됩니다).
- 묶음 하나는 보통 노트 2~7개. 너무 크면 쪼개세요.

각 묶음에 대해:
- title: 이 묶음이 무엇을 배우는 단위인지 (예: "필러 혈관 합병증 — 예방부터 응급 대응까지").
- description: 왜 이 노트들을 함께 봐야 하는지, 이 묶음을 끝내면 무엇을 할 수 있게 되는지 1~2문장.
- suggestions: 이 묶음을 마친 뒤 **추가로 연계해서 공부하면 좋은 주제** 2~3개 (아직 노트가 없어도 되는, 공부거리 제안).
- entryIds: 학습 순서대로 정렬된 노트 id 배열 (반드시 위 목록의 id만 사용).

<notes>
${noteList}
</notes>`;
}

export const anthropicClusterCaller: ClusterCaller = async (input) => {
  if (input.notes.length < 2) return [];
  const client = getAnthropicClient();
  const validIds = input.notes.map((n) => n.id);

  // Sonnet runs adaptive thinking by default — no `thinking` param needed.
  const response = await client.messages.create({
    model: MID_MODEL,
    max_tokens: 8000,
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            clusters: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  suggestions: { type: "array", items: { type: "string" } },
                  entryIds: {
                    type: "array",
                    items: { type: "string", enum: validIds },
                  },
                },
                required: ["title", "description", "suggestions", "entryIds"],
                additionalProperties: false,
              },
            },
          },
          required: ["clusters"],
          additionalProperties: false,
        },
      },
    },
    messages: [{ role: "user", content: buildClusterPrompt(input) }],
  });

  if (response.stop_reason === "refusal") return [];
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") return [];

  const parsed = JSON.parse(textBlock.text) as { clusters: ClusterResult[] };
  return normalizeClusters(parsed.clusters, validIds);
};

/** Drop unknown/duplicate ids and empty clusters — the model's output is
 * enum-constrained but we defend against dupes across clusters. */
export function normalizeClusters(clusters: ClusterResult[], validIds: string[]): ClusterResult[] {
  const valid = new Set(validIds);
  const used = new Set<string>();
  const out: ClusterResult[] = [];
  for (const cluster of clusters) {
    const ids: string[] = [];
    for (const id of cluster.entryIds) {
      if (valid.has(id) && !used.has(id)) {
        ids.push(id);
        used.add(id);
      }
    }
    if (ids.length >= 2) {
      out.push({ ...cluster, entryIds: ids });
    }
  }
  return out;
}

/** Offline/deterministic: group by category label so /study is explorable
 * without an API key. */
export const fakeClusterCaller: ClusterCaller = async (input) => {
  const byCategory = new Map<string, ClusterNoteDigest[]>();
  for (const note of input.notes) {
    if (!byCategory.has(note.categoryLabel)) byCategory.set(note.categoryLabel, []);
    byCategory.get(note.categoryLabel)!.push(note);
  }
  const clusters: ClusterResult[] = [];
  for (const [label, notes] of byCategory) {
    if (notes.length < 2) continue;
    clusters.push({
      title: `[FAKE] ${label} 묶음`,
      description: `${label} 관련 노트 ${notes.length}개를 함께 학습하는 오프라인 묶음입니다.`,
      suggestions: ["실제 모드에서는 연계 학습 주제가 제안됩니다."],
      entryIds: notes.map((n) => n.id),
    });
  }
  return clusters;
};

export function defaultClusterCaller(): ClusterCaller {
  return isFakeMode() ? fakeClusterCaller : anthropicClusterCaller;
}
