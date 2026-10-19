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
import { getSection } from "../../lib/bbip/sections";
import { CASE_INPUT_ID, CaseInput } from "./CaseInput";
import { ChipBar } from "./ChipBar";
import { FlagBanner } from "./FlagBanner";
import { turnEndpoint } from "./LiteratureFootnotes";
import { MoreMenu } from "./MoreMenu";
import { PromoteDialog } from "./PromoteDialog";
import { RecentCases } from "./RecentCases";
import { SheetSection } from "./SheetSection";
import { AnatomySection, hasAnatomyMap } from "./anatomy/AnatomySection";
import { TurnCard } from "./TurnCard";
import { useRecentSessions } from "./useRecentSessions";

const EXAMPLES = [
  "20대 여성, 여드름 흉터, 이소트레티노인 복용, 레이저 상담",
  "30대 남성, 사각턱, 보톡스 처음",
  "50대 여성, 팔자주름, 와파린 복용, 필러 상담",
];

const GROUP_LABELS = { safety: "안전", practice: "실무", business: "비즈니스" } as const;

/** Margin label for an opened card. */
function marginFor(turn: ClientTurn): { label: string; note?: string; title?: string } {
  if (turn.kind === "section" && turn.sectionKey) {
    const section = getSection(turn.sectionKey);
    return { label: section.label, note: GROUP_LABELS[section.group] };
  }
  if (turn.kind === "literature") return { label: "문헌 근거", note: "PubMed · 웹" };
  return {
    label: turn.kind === "followup" ? "이어서 묻기" : "직접 질문",
    title: turn.question,
  };
}

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
        const endpoint = turnEndpoint(sessionId, request);
        const res = await fetch(endpoint.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: endpoint.body,
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
  // Anatomy map (Plan 3) takes sheet index 03 when the case maps to the atlas.
  const sheetShift = session && hasAnatomyMap(session) ? 1 : 0;
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
      {/* Masthead — the case line, with recent cases in the right column. */}
      <section
        aria-labelledby="bbip-title"
        className="grid gap-x-20 gap-y-10 pb-14 pt-2 md:grid-cols-[minmax(0,1fr)_240px] md:pt-8 lg:grid-cols-[minmax(0,1fr)_300px]"
      >
        <div className="min-w-0">
          <div className="mb-7 flex items-center gap-3 text-[14px] text-ink/60">
            BBIP
            <span className="h-px w-12 bg-ink/25" />
            미용 GP 진료 비서
          </div>
          <h1
            id="bbip-title"
            className={`break-keep leading-[1.08] tracking-tight text-ink transition-[font-size] duration-500 ${
              session ? "text-[2.3rem] md:text-[3rem]" : "text-[2.9rem] md:text-[4.6rem]"
            }`}
          >
            케이스를 적으면,
            <br />
            <span className="font-serifa font-bold italic">핵심부터.</span>
          </h1>
          {!session && (
            <p className="mt-6 max-w-[540px] text-[15.5px] leading-[1.75] text-ink/60">
              한 줄 메모에서 금기와 주의를 먼저 짚고, 내 노트를 근거로 진료 전에 볼 것만 추려 드립니다.
            </p>
          )}

          <div className="mt-10">
            <CaseInput
              value={draft}
              onValueChange={setDraft}
              disabled={opening}
              onSubmit={(input) => void openSession({ input })}
            />
          </div>
          {error && (
            <p role="alert" className="mt-4 border-l-2 border-red-700 pl-3 text-[15.5px] text-red-800">
              {error}
            </p>
          )}

          {!session && (
            <div className="mt-8 flex flex-wrap items-baseline gap-x-2 gap-y-2 text-[15px]">
              <span className="mr-2 text-[13px] font-medium text-ink/65">예시</span>
              {EXAMPLES.map((example, i) => (
                <span key={example} className="inline-flex items-baseline gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDraft(example);
                      document.getElementById(CASE_INPUT_ID)?.focus();
                    }}
                    className="text-ink/70 underline decoration-ink/20 underline-offset-4 transition hover:text-ink hover:decoration-ink"
                  >
                    {example}
                  </button>
                  {i < EXAMPLES.length - 1 && <span className="text-ink/25">/</span>}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* On phones an open case owns the screen; history is one tap away in 기록. */}
        <div className={session ? "hidden md:block" : ""}>
          <RecentCases sessions={sessions} activeId={session?.id ?? null} />
        </div>
      </section>

      {session && (
        <>
          <SheetSection
            id="bbip-case"
            index="01"
            label="케이스"
            note={state.degraded ? <span className="text-amber-800">자동 분류에 실패해 쉼표로만 나눴습니다. 확인해 주세요.</span> : "항목을 지우거나 더하면 다시 작성합니다."}
          >
            <ChipBar
              chips={session.chips}
              disabled={opening}
              onChange={(chips) => void openSession({ chips, baseSessionId: session.id })}
            />
            <FlagBanner flags={session.flags} />
          </SheetSection>

          {brief && (
            <SheetSection
              id="bbip-brief"
              index="02"
              label="핵심"
              note={
                verifiedNotes > 0
                  ? `내 노트 ${verifiedNotes}개를 근거로 작성`
                  : "관련 노트가 없어 일반 지식(AI) 위주로 작성"
              }
            >
              <TurnCard
                turn={brief}
                notes={state.notes}
                literature={session.literature}
                onRetry={retry}
                onPromote={setPromoteTurnId}
              />
            </SheetSection>
          )}

          {/* ── Anatomy map (Plan 3) — renders from the chips, no AI call ── */}
          <AnatomySection session={session} index="03" notes={state.notes} />

          {brief && brief.status !== "streaming" && (
            <SheetSection id="bbip-more" index={String(3 + sheetShift).padStart(2, "0")} label="더 보기" note="필요한 것만 펼쳐 보세요.">
              <MoreMenu
                followups={brief.followups}
                openedSections={openedSections}
                openedQuestions={openedQuestions}
                literatureOpened={state.turns.some((t) => t.kind === "literature")}
                onRequest={(request) => void runTurn(session.id, request)}
              />
            </SheetSection>
          )}

          {others.map((turn, i) => {
            const margin = marginFor(turn);
            return (
              <SheetSection
                key={turn.key}
                id={`bbip-turn-${turn.key}`}
                index={String(i + 4 + sheetShift).padStart(2, "0")}
                label={margin.label}
                note={margin.note}
              >
                <TurnCard
                  turn={turn}
                  title={margin.title}
                  notes={state.notes}
                  literature={session.literature}
                  onRetry={retry}
                  onPromote={setPromoteTurnId}
                />
              </SheetSection>
            );
          })}
        </>
      )}

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
