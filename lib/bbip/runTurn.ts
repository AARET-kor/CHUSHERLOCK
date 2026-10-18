import { isFakeMode } from "../ai/client";
import type { CodexEntry } from "../codex/types";
import { listEntries } from "../services/entryService";
import {
  failTurn,
  finishTurn,
  getSession,
  listTurns,
  startTurn,
} from "../services/bbipService";
import { FollowupExtractor } from "./followups";
import { generateTurnText, type GenerateArgs } from "./generate";
import { modelForRequest } from "./models";
import type { StreamEvent, TurnRequest } from "./types";

export interface RunTurnDeps {
  listEntries: () => Promise<CodexEntry[]>;
  generate: (args: GenerateArgs) => AsyncIterable<string>;
}

const defaultDeps: RunTurnDeps = { listEntries: () => listEntries(), generate: generateTurnText };

/** Generates one card and persists it as it goes. The turn row is written
 * as "streaming" first and closed as "done"/"failed", so a client that
 * disconnects can still find the finished card in history. */
export async function* runTurn(
  sessionId: string,
  request: TurnRequest,
  deps: RunTurnDeps = defaultDeps
): AsyncGenerator<StreamEvent> {
  const session = getSession(sessionId);
  if (!session) {
    yield { type: "error", message: "세션을 찾을 수 없습니다." };
    return;
  }
  const wanted = new Set(session.sourceNoteIds);
  const entries = (await deps.listEntries()).filter((e) => wanted.has(e.id));
  const priorTurns = listTurns(sessionId).filter((t) => t.status === "done");
  const model = isFakeMode() ? "fake" : modelForRequest(request).model;
  const turn = startTurn(sessionId, request, model);
  yield { type: "start", turnId: turn.id };

  const extractor = request.kind === "brief" ? new FollowupExtractor() : null;
  let output = "";
  try {
    for await (const chunk of deps.generate({ session, entries, priorTurns, request })) {
      const visible = extractor ? extractor.push(chunk) : chunk;
      if (visible) {
        output += visible;
        yield { type: "delta", text: visible };
      }
    }
    const finished = extractor?.finish() ?? { tail: "", followups: [] };
    if (finished.tail) {
      output += finished.tail;
      yield { type: "delta", text: finished.tail };
    }
    finishTurn(turn.id, output.trimEnd(), finished.followups);
    if (finished.followups.length) yield { type: "followups", items: finished.followups };
    yield { type: "done", turnId: turn.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    failTurn(turn.id, output, message);
    yield { type: "error", message: `생성 실패: ${message}` };
  }
}
