import type {
  BbipSession,
  BbipTurn,
  NoteRef,
  SectionKey,
  SessionView,
  StreamEvent,
  TurnKind,
  TurnRequest,
  TurnStatus,
} from "./types";

export interface ClientTurn {
  /** Stable React key; equals the server id for hydrated turns. */
  key: string;
  id?: string;
  kind: TurnKind;
  sectionKey?: SectionKey;
  question?: string;
  output: string;
  followups: string[];
  status: TurnStatus;
  error?: string;
  promotedEntryId?: string;
}

export interface ConsoleState {
  session: BbipSession | null;
  notes: NoteRef[];
  turns: ClientTurn[];
  degraded: boolean;
}

export type ConsoleAction =
  | { type: "reset"; view: SessionView; degraded: boolean }
  | { type: "turn-start"; key: string; request: TurnRequest }
  | { type: "turn-event"; key: string; event: StreamEvent }
  | { type: "turn-remove"; key: string }
  | { type: "promoted"; turnId: string; entryId: string }
  /** Server snapshot for turns hydrated while still streaming (page reload
   * mid-generation): replaces those cards once the server has moved on. */
  | { type: "sync"; turns: BbipTurn[] };

function fromServer(turn: BbipTurn): ClientTurn {
  return {
    key: turn.id,
    id: turn.id,
    kind: turn.kind,
    sectionKey: turn.sectionKey,
    question: turn.question,
    output: turn.output,
    followups: turn.followups,
    status: turn.status,
    error: turn.error,
    promotedEntryId: turn.promotedEntryId,
  };
}

export function initialConsoleState(view: SessionView | null): ConsoleState {
  if (!view) return { session: null, notes: [], turns: [], degraded: false };
  const sameRequest = (a: BbipTurn, b: BbipTurn) =>
    a.kind === b.kind && a.sectionKey === b.sectionKey && a.question === b.question;
  // A failed turn is dropped once a later turn repeated the same request
  // (a retry); otherwise it stays so the user can retry it.
  const turns = view.turns
    .filter((t, i) => t.status !== "failed" || !view.turns.slice(i + 1).some((later) => sameRequest(t, later)))
    .map(fromServer);
  return { session: view.session, notes: view.notes, turns, degraded: false };
}

export function requestOf(turn: ClientTurn): TurnRequest {
  return { kind: turn.kind, sectionKey: turn.sectionKey, question: turn.question };
}

function applyEvent(turn: ClientTurn, event: StreamEvent): ClientTurn {
  switch (event.type) {
    case "start":
      return { ...turn, id: event.turnId };
    case "delta":
      return { ...turn, output: turn.output + event.text };
    case "followups":
      return { ...turn, followups: event.items };
    case "done":
      return { ...turn, id: event.turnId, status: "done" };
    case "error":
      return { ...turn, status: "failed", error: event.message };
  }
}

export function consoleReducer(state: ConsoleState, action: ConsoleAction): ConsoleState {
  switch (action.type) {
    case "reset":
      return { ...initialConsoleState(action.view), degraded: action.degraded };
    case "turn-start":
      return {
        ...state,
        turns: [
          ...state.turns,
          {
            key: action.key,
            kind: action.request.kind,
            sectionKey: action.request.sectionKey,
            question: action.request.question,
            output: "",
            followups: [],
            status: "streaming",
          },
        ],
      };
    case "turn-event":
      return {
        ...state,
        turns: state.turns.map((t) => (t.key === action.key ? applyEvent(t, action.event) : t)),
      };
    case "turn-remove":
      return { ...state, turns: state.turns.filter((t) => t.key !== action.key) };
    case "promoted":
      return {
        ...state,
        turns: state.turns.map((t) =>
          t.id === action.turnId ? { ...t, promotedEntryId: action.entryId } : t
        ),
      };
    case "sync": {
      const byId = new Map(action.turns.map((t) => [t.id, t]));
      return {
        ...state,
        turns: state.turns.map((t) => {
          const server = t.id ? byId.get(t.id) : undefined;
          return server && t.key === t.id && t.status === "streaming" ? fromServer(server) : t;
        }),
      };
    }
  }
}

/** Hydrated cards still streaming on the server (not driven by this tab). */
export function hasDetachedStreaming(state: ConsoleState): boolean {
  return state.turns.some((t) => t.status === "streaming" && t.key === t.id);
}
