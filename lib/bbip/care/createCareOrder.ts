// lib/bbip/care/createCareOrder.ts
import { isFakeMode } from "../../ai/client";
import type { CodexEntry } from "../../codex/types";
import { getSession } from "../../services/bbipService";
import { getCareSetsFor, saveCareOrder } from "../../services/careService";
import { listEntries } from "../../services/entryService";
import { selectPromptNotes } from "../context";
import { CareGenerationError, CareNotFoundError } from "./errors";
import { callCareModel, fakeCareResponse, type CareCallResult } from "./generate";
import { caseText, interactionsFor } from "./interactions";
import { canConfirm } from "./lint";
import { parseCareResponse, type ParsedCare } from "./parse";
import { buildCareContext, type CareContext } from "./prompt";
import { dedupeKey, seedFromSets } from "./sets";
import type { CareItem, CareOrder } from "./types";

export { CareNotFoundError };

export interface CareDeps {
  listEntries: () => Promise<CodexEntry[]>;
  /** Model draft (or set adjustment) for the assembled context. */
  generate: (context: CareContext, seed: CareItem[]) => Promise<CareCallResult>;
}

function defaultDeps(): CareDeps {
  return {
    listEntries: () => listEntries(),
    generate: async (context, seed) =>
      isFakeMode()
        ? { text: fakeCareResponse(seed.length > 0), model: "fake", stopReason: "end_turn" }
        : callCareModel(context),
  };
}

/** Saved sets seed the order; the model drafts (no set) or adjusts (set).
 * Set rows the doctor confirmed before start confirmed unless this case
 * trips an interaction rule or a lint error. */
export async function createCareOrder(sessionId: string, deps: CareDeps = defaultDeps()): Promise<CareOrder> {
  const session = getSession(sessionId);
  if (!session) throw new CareNotFoundError();
  const wanted = new Set(session.sourceNoteIds);
  const notes = selectPromptNotes(session, (await deps.listEntries()).filter((entry) => wanted.has(entry.id)));
  const sets = getCareSetsFor(session.chips.procedures);
  const seed = seedFromSets(sets);

  const notices: string[] = [];
  let parsed: ParsedCare = { caution: "", items: [], removals: new Map(), dropped: 0 };
  let model = "set";
  try {
    const result = await deps.generate(buildCareContext({ session, notes, setItems: seed }), seed);
    model = result.model;
    parsed = parseCareResponse(result.text, {
      notes: notes.map(({ n, verified }) => ({ n, verified })),
      literature: session.literature,
      setIds: new Set(seed.map((item) => item.id)),
    });
  } catch (error) {
    if (seed.length === 0) throw error;
    console.warn("[bbip] care adjustment failed:", error instanceof Error ? error.message : "unknown");
    notices.push("AI 조정에 실패해 내 세트만 표시합니다.");
  }
  if (parsed.dropped > 0) notices.push(`형식이 맞지 않는 ${parsed.dropped}개 행을 뺐습니다.`);

  const context = caseText(session.chips, session.flags);
  const seeded = seed.map((item): CareItem => {
    const reason = parsed.removals.get(item.id);
    if (reason) return { ...item, removed: { reason } };
    return { ...item, confirmed: interactionsFor(item, context).length === 0 && canConfirm(item, context) };
  });
  const inSet = new Set(seed.map(dedupeKey));
  const added = parsed.items.filter((item) => !inSet.has(dedupeKey(item)));
  const items = [...seeded, ...added];
  if (items.length === 0) throw new CareGenerationError("오더 행을 만들지 못했습니다.");

  return saveCareOrder({
    sessionId,
    items,
    setKeys: sets.map((set) => set.procedureKey),
    caution: parsed.caution,
    notices,
    model,
  });
}
