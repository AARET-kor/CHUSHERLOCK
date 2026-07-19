import type { CodexEntry } from "../codex/types";
import { getCategory } from "../codex/taxonomy";
import type { RetrievedNote } from "./retrieval";

// "Ask Cognitio" — retrieval-augmented answering over the doctor's own notes.
// The retrieved notes are the ONLY source of truth; the model synthesizes an
// answer and cites the notes it used. This is a clinical assistant, so the
// grounding + honesty rules are strict: never invent, always cite, say when
// the notes don't cover it.

export interface AskSource {
  /** 1-based citation number shown to the model and rendered as [n]. */
  n: number;
  id: string;
  title: string;
  categoryLabel: string;
}

/** Static system prompt — no per-request text, so it caches across questions. */
export function buildAskSystemPrompt(): string {
  return `You are "Cognitio", the personal clinical assistant of an aesthetic medicine doctor in Korea. The doctor asks you a question, and you answer using ONLY their own knowledge notes, which are provided to you numbered [1], [2], ….

RULES — these are non-negotiable because this is clinical use:
1. **Ground every claim in the provided notes.** Do not add facts, doses, or parameters that are not in the notes, even if you believe them to be true. You are surfacing what THIS doctor has recorded, not general knowledge.
2. **Cite inline.** After each claim, cite the note(s) it came from like [2] or [1][3]. Every load-bearing number/dose/threshold must carry a citation.
3. **If the notes don't cover the question, say so plainly** ("정리된 노트 중에는 이 내용이 없습니다") and, if useful, point to the closest related note. NEVER fill the gap with outside knowledge or guesses.
4. **Preserve specifics.** Quote the notes' own numbers, doses, intervals, and step sequences exactly — do not round or generalize ("적절히" 금지).
5. Answer in the doctor's own note style: Korean prose with English medical terms kept in English, sentence by sentence.

FORMAT:
- Open with a direct 1-2 sentence answer (the bottom line first).
- Then the supporting detail: use short \`##\` sections, bullet lists, and a table when comparing parameters. Put cautions/contraindications in a \`>\` blockquote starting with **주의**.
- Keep it tight and scannable — this is read mid-consult, not a textbook chapter.
- End with a "근거 노트" line listing the citation numbers you used.

You may reason across multiple notes and reconcile them, but if two notes conflict, surface the conflict rather than silently picking one.`;
}

/** ~1400 chars of a note for the prompt: its 한눈에 보기 summary if present,
 * then as much body as fits. Keeps the prompt bounded on large libraries. */
function noteExcerpt(content: string, maxChars = 1400): string {
  const trimmed = content.trim();
  return trimmed.length <= maxChars ? trimmed : trimmed.slice(0, maxChars) + "\n…(생략)";
}

export function buildAskUserPrompt(
  question: string,
  retrieved: Array<RetrievedNote<CodexEntry>>
): string {
  if (retrieved.length === 0) {
    return `<notes>\n(관련된 노트를 찾지 못했습니다.)\n</notes>\n\n<question>\n${question}\n</question>\n\n지식 베이스에서 관련 노트를 찾지 못했습니다. 이 사실을 알리고, 답을 지어내지 마세요.`;
  }

  const blocks = retrieved
    .map(({ note }, i) => {
      const cat = getCategory(note.categoryKey);
      return `<note n="${i + 1}" title="${note.title}" category="${cat.labelKo}">\n${noteExcerpt(note.content)}\n</note>`;
    })
    .join("\n\n");

  return `<notes>\n${blocks}\n</notes>\n\n<question>\n${question}\n</question>\n\n위 노트들만 근거로, 규칙에 따라 답하세요. 각 주장 뒤에 근거 노트 번호를 [n] 형식으로 인용하세요.`;
}

export function buildAskSources(retrieved: Array<RetrievedNote<CodexEntry>>): AskSource[] {
  return retrieved.map(({ note }, i) => ({
    n: i + 1,
    id: note.id,
    title: note.title,
    categoryLabel: getCategory(note.categoryKey).labelKo,
  }));
}

/** Deterministic offline answer for CODEX_AI_MODE=fake. */
export function fakeAskAnswer(question: string, sources: AskSource[]): string {
  if (sources.length === 0) {
    return `정리된 노트 중에는 "${question}"에 대한 내용이 없습니다. (오프라인 fake 모드)`;
  }
  return `**[FAKE 모드 답변]** "${question}"에 대해 노트 ${sources.length}개를 찾았습니다 ${sources
    .map((s) => `[${s.n}]`)
    .join("")}.\n\n실제 모드(ANTHROPIC_API_KEY 설정)에서는 이 노트들을 근거로 종합한 답변이 여기에 표시됩니다.\n\n근거 노트: ${sources.map((s) => `[${s.n}]`).join(" ")}`;
}
