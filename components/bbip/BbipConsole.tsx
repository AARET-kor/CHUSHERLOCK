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
import { Info, Stethoscope } from "lucide-react";
import { CASE_INPUT_ID, CaseInput } from "./CaseInput";
import { ChipBar } from "./ChipBar";
import { FlagBanner } from "./FlagBanner";
import { HistoryDrawer } from "./HistoryDrawer";
import { MoreMenu } from "./MoreMenu";
import { PromoteDialog } from "./PromoteDialog";
import { RecentCases } from "./RecentCases";
import { SectionHeading } from "./SectionHeading";
import { TurnCard } from "./TurnCard";
import { useRecentSessions } from "./useRecentSessions";

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
  const [draft, setDraft] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const keySeq = useRef(0);
  const openingRef = useRef(false);
  const controllers = useRef(new Set<AbortController>());

  const newController = useCallback(() => {
    const controller = new AbortController();
    controllers.current.add(controller);
    return controller;
  }, []);

  const abortAll = useCallback(() => {
    for (const controller of controllers.current) controller.abort();
    controllers.current.clear();
  }, []);

  useEffect(() => abortAll, [abortAll]);

  const runTurn = useCallback(
    async (sessionId: string, request: TurnRequest) => {
      const key = `local-${++keySeq.current}`;
      const controller = newController();
      dispatch({ type: "turn-start", key, request });
      try {
        const res = await fetch(`/api/bbip/sessions/${sessionId}/turns`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request),
          signal: controller.signal,
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
      } catch (err) {
        if (controller.signal.aborted || (err instanceof DOMException && err.name === "AbortError")) return;
        dispatch({ type: "turn-event", key, event: { type: "error", message: "네트워크 오류" } });
      } finally {
        controllers.current.delete(controller);
      }
    },
    [newController]
  );

  // Reloaded mid-generation: the server keeps streaming into the DB, so poll
  // the session until those cards settle. Chained timeouts with one request
  // in flight at a time.
  const detached = hasDetachedStreaming(state);
  const sessionId = state.session?.id;
  useEffect(() => {
    if (!detached || !sessionId) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let inflight: AbortController | null = null;
    const tick = async () => {
      const controller = newController();
      inflight = controller;
      try {
        const res = await fetch(`/api/bbip/sessions/${sessionId}`, { signal: controller.signal });
        if (res.ok && !stopped) {
          const data = await res.json().catch(() => ({}));
          if (Array.isArray(data.turns)) dispatch({ type: "sync", turns: data.turns });
        }
      } catch {
        /* next tick retries (aborts end the loop below) */
      } finally {
        controllers.current.delete(controller);
        inflight = null;
      }
      if (!stopped && !controller.signal.aborted) timer = setTimeout(tick, 2000);
    };
    timer = setTimeout(tick, 2000);
    return () => {
      stopped = true;
      clearTimeout(timer);
      inflight?.abort();
    };
  }, [detached, sessionId, newController]);

  async function openSession(body: { input: string } | { chips: ParsedCase; baseSessionId?: string }) {
    if (openingRef.current) return;
    openingRef.current = true;
    setOpening(true);
    setError(null);
    const controller = newController();
    try {
      const res = await fetch("/api/bbip/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.session) {
        setError(data.error ?? "케이스를 열지 못했습니다.");
        return;
      }
      // Stop the previous session's streams/polls before switching.
      abortAll();
      dispatch({
        type: "reset",
        view: { session: data.session, turns: [], notes: data.notes },
        degraded: data.degraded,
      });
      // Shareable URL without a server round trip (keeps this component mounted).
      window.history.replaceState(null, "", `/?s=${data.session.id}`);
      void runTurn(data.session.id, { kind: "brief" });
    } catch (err) {
      if (controller.signal.aborted || (err instanceof DOMException && err.name === "AbortError")) return;
      setError("네트워크 오류로 케이스를 열지 못했습니다.");
    } finally {
      controllers.current.delete(controller);
      openingRef.current = false;
      setOpening(false);
    }
  }

  function retry(turn: ClientTurn) {
    if (!state.session) return;
    dispatch({ type: "turn-remove", key: turn.key });
    void runTurn(state.session.id, requestOf(turn));
  }

  const session = state.session;
  const briefs = state.turns.filter((t) => t.kind === "brief");
  // Prefer the latest brief that did not fail (a retry may sit after a failure).
  const brief = [...briefs].reverse().find((t) => t.status !== "failed") ?? briefs[briefs.length - 1];
  const others = state.turns.filter((t) => t !== brief);
  const openedSections = new Set(
    state.turns.flatMap((t) => (t.kind === "section" && t.sectionKey ? [t.sectionKey] : []))
  ) as Set<SectionKey>;
  const openedQuestions = new Set(
    state.turns.flatMap((t) => (t.kind === "followup" && t.question ? [t.question] : []))
  );

  // Unreviewed BBIP drafts are AI content, not "my notes".
  const verifiedNotes = state.notes.filter((n) => n.verified).length;

  const sessions = useRecentSessions(session?.id ?? null);

  return (
    <div>
      <section
        aria-labelledby="bbip-title"
        className="mb-8 overflow-hidden rounded-[28px] bg-inkdeep text-white shadow-[0_24px_70px_rgba(5,26,36,0.16)]"
      >
        <div className="grid gap-8 px-6 py-7 md:grid-cols-[1.3fr_0.7fr] md:px-8 md:py-9">
          <div className="min-w-0">
            <div className="mb-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-white/55">
              <Stethoscope aria-hidden="true" className="h-3.5 w-3.5" />
              <span>BBIP · Chairside brief</span>
            </div>
            <h1
              id="bbip-title"
              className="max-w-2xl font-serifa text-3xl font-bold leading-tight tracking-tight md:text-[38px]"
            >
              미용 GP 진료 비서
              <br />
              <span className="text-2xl text-white/80 md:text-[28px]">
                케이스를 넣으면, <span className="italic text-[#bfe7d1]">핵심부터.</span>
              </span>
            </h1>
            <p className="mb-6 mt-4 max-w-xl text-sm leading-relaxed text-white/65">
              한 줄 케이스 메모로 금기·주의를 먼저 짚고, 내 노트를 근거로 진료 전에 볼 핵심을 정리합니다.
            </p>

            <CaseInput
              value={draft}
              onValueChange={setDraft}
              disabled={opening}
              onSubmit={(input) => void openSession({ input })}
            />
            {error && (
              <p role="alert" className="mt-3 rounded-xl bg-red-500/15 px-3 py-2 text-sm text-red-100 ring-1 ring-red-300/30">
                {error}
              </p>
            )}

            {session && (
              <>
                <ChipBar
                  chips={session.chips}
                  disabled={opening}
                  onChange={(chips) => void openSession({ chips, baseSessionId: session.id })}
                />
                {state.degraded && (
                  <p className="mt-2 text-xs text-amber-200">
                    자동 분류에 실패해 단순 분리했습니다 — 칩을 확인하세요.
                  </p>
                )}
              </>
            )}
          </div>

          <RecentCases
            sessions={sessions}
            activeId={session?.id ?? null}
            showExamples={!session}
            onExample={(example) => {
              setDraft(example);
              document.getElementById(CASE_INPUT_ID)?.focus();
            }}
            onOpenHistory={() => setHistoryOpen(true)}
          />
        </div>
      </section>

      {session && (
        <>
          <FlagBanner flags={session.flags} />

          {brief && (
            <section aria-labelledby="bbip-brief">
              <SectionHeading
                id="bbip-brief"
                index="01"
                kicker="Core brief"
                meta={
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-mist px-3 py-1.5 text-[11px] font-medium text-ink/70">
                    <Info aria-hidden="true" className="h-3.5 w-3.5" />
                    {verifiedNotes > 0
                      ? `내 노트 ${verifiedNotes}개를 근거로`
                      : "내 노트에 관련 자료 없음 — AI 보충 위주"}
                  </span>
                }
              >
                먼저 볼 <span className="italic">핵심</span>
              </SectionHeading>
              <TurnCard turn={brief} notes={state.notes} onRetry={retry} onPromote={setPromoteTurnId} />
            </section>
          )}
          {brief && brief.status !== "streaming" && (
            <MoreMenu
              followups={brief.followups}
              openedSections={openedSections}
              openedQuestions={openedQuestions}
              onRequest={(request) => void runTurn(session.id, request)}
            />
          )}
          {others.length > 0 && (
            <section aria-labelledby="bbip-opened" className="mt-12">
              <SectionHeading id="bbip-opened" index="03" kicker="Opened cards">
                열어 본 <span className="italic">카드</span>
              </SectionHeading>
              <div className="space-y-4">
                {others.map((turn) => (
                  <TurnCard
                    key={turn.key}
                    turn={turn}
                    notes={state.notes}
                    onRetry={retry}
                    onPromote={setPromoteTurnId}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <HistoryDrawer
        sessions={sessions}
        activeId={session?.id ?? null}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
      />

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
