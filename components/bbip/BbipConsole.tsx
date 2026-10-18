"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { CategoryDef } from "../../lib/codex/types";
import {
  consoleReducer,
  hasDetachedStreaming,
  initialConsoleState,
  requestOf,
  type ClientTurn,
} from "../../lib/bbip/consoleState";
import { readNdjson } from "../../lib/bbip/readNdjson";
import type { ParsedCase, SectionKey, SessionView, TurnRequest } from "../../lib/bbip/types";
import { CaseInput } from "./CaseInput";
import { ChipBar } from "./ChipBar";
import { FlagBanner } from "./FlagBanner";
import { HistoryDrawer } from "./HistoryDrawer";
import { MoreMenu } from "./MoreMenu";
import { PromoteDialog } from "./PromoteDialog";
import { TurnCard } from "./TurnCard";

export function BbipConsole({
  initialView,
  leafCategories,
}: {
  initialView: SessionView | null;
  leafCategories: CategoryDef[];
}) {
  const [state, dispatch] = useReducer(consoleReducer, initialView, initialConsoleState);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [promoteTurnId, setPromoteTurnId] = useState<string | null>(null);
  const keySeq = useRef(0);

  const runTurn = useCallback(async (sessionId: string, request: TurnRequest) => {
    const key = `local-${++keySeq.current}`;
    dispatch({ type: "turn-start", key, request });
    try {
      const res = await fetch(`/api/bbip/sessions/${sessionId}/turns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        dispatch({
          type: "turn-event",
          key,
          event: { type: "error", message: data.error ?? "생성 요청에 실패했습니다." },
        });
        return;
      }
      let terminal = false;
      for await (const event of readNdjson(res.body)) {
        if (event.type === "done" || event.type === "error") terminal = true;
        dispatch({ type: "turn-event", key, event });
      }
      if (!terminal) {
        dispatch({ type: "turn-event", key, event: { type: "error", message: "연결이 끊겼습니다." } });
      }
    } catch {
      dispatch({ type: "turn-event", key, event: { type: "error", message: "네트워크 오류" } });
    }
  }, []);

  // Reloaded mid-generation: the server keeps streaming into the DB, so poll
  // the session until those cards settle.
  const detached = hasDetachedStreaming(state);
  const sessionId = state.session?.id;
  useEffect(() => {
    if (!detached || !sessionId) return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/bbip/sessions/${sessionId}`);
        if (res.ok) dispatch({ type: "sync", turns: (await res.json()).turns });
      } catch {
        /* next tick retries */
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [detached, sessionId]);

  async function openSession(body: { input: string } | { chips: ParsedCase }) {
    setOpening(true);
    setError(null);
    try {
      const res = await fetch("/api/bbip/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "케이스를 열지 못했습니다.");
        return;
      }
      dispatch({
        type: "reset",
        view: { session: data.session, turns: [], notes: data.notes },
        degraded: data.degraded,
      });
      // Shareable URL without a server round trip (keeps this component mounted).
      window.history.replaceState(null, "", `/?s=${data.session.id}`);
      void runTurn(data.session.id, { kind: "brief" });
    } catch {
      setError("네트워크 오류로 케이스를 열지 못했습니다.");
    } finally {
      setOpening(false);
    }
  }

  function retry(turn: ClientTurn) {
    if (!state.session) return;
    dispatch({ type: "turn-remove", key: turn.key });
    void runTurn(state.session.id, requestOf(turn));
  }

  const session = state.session;
  const brief = state.turns.find((t) => t.kind === "brief");
  const others = state.turns.filter((t) => t !== brief);
  const openedSections = new Set(
    state.turns.flatMap((t) => (t.kind === "section" && t.sectionKey ? [t.sectionKey] : []))
  ) as Set<SectionKey>;

  return (
    <div className="flex gap-6">
      <HistoryDrawer activeId={session?.id ?? null} />
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex items-center gap-3 font-mono text-[10px] tracking-[0.2em] md:text-[11px]">
          <span className="text-ink/60">[ BBIP ]</span>
          <span className="font-bold uppercase text-ink">케이스를 넣으면 핵심부터</span>
        </div>
        <h1 className="mb-5 font-serifa text-2xl font-bold tracking-tight text-inkdeep md:text-3xl">
          미용 GP 진료 비서
        </h1>

        <CaseInput disabled={opening} onSubmit={(input) => void openSession({ input })} />
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {session && (
          <>
            <ChipBar
              chips={session.chips}
              disabled={opening}
              onChange={(chips) => void openSession({ chips })}
            />
            {state.degraded && (
              <p className="mt-2 text-xs text-amber-800">
                자동 분류에 실패해 단순 분리했습니다 — 칩을 확인하세요.
              </p>
            )}
            <FlagBanner flags={session.flags} />
            {state.notes.length === 0 && (
              <p className="mt-3 text-xs text-ink/60">
                내 노트에 관련 자료가 없습니다 — 아래 내용은 🤖AI 보충 위주입니다.
              </p>
            )}

            {brief && (
              <TurnCard turn={brief} notes={state.notes} onRetry={retry} onPromote={setPromoteTurnId} />
            )}
            {brief && brief.status !== "streaming" && (
              <MoreMenu
                followups={brief.followups}
                openedSections={openedSections}
                onRequest={(request) => void runTurn(session.id, request)}
              />
            )}
            {others.map((turn) => (
              <TurnCard
                key={turn.key}
                turn={turn}
                notes={state.notes}
                onRetry={retry}
                onPromote={setPromoteTurnId}
              />
            ))}
          </>
        )}
      </div>

      {promoteTurnId && (
        <PromoteDialog
          turnId={promoteTurnId}
          leafCategories={leafCategories}
          onClose={() => setPromoteTurnId(null)}
          onSaved={(entryId) => {
            dispatch({ type: "promoted", turnId: promoteTurnId, entryId });
            setPromoteTurnId(null);
          }}
        />
      )}
    </div>
  );
}
