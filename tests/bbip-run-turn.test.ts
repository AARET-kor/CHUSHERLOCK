// tests/bbip-run-turn.test.ts
import Anthropic from "@anthropic-ai/sdk";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { StreamEvent } from "../lib/bbip/types";
import { setupTempDb } from "./helpers/tempDb";

let env: Awaited<ReturnType<typeof setupTempDb>>;
let service: typeof import("../lib/services/bbipService");
let runTurnModule: typeof import("../lib/bbip/runTurn");
let generateModule: typeof import("../lib/bbip/generate");

beforeAll(async () => {
  env = await setupTempDb("bbip-run-turn");
  service = await import("../lib/services/bbipService");
  runTurnModule = await import("../lib/bbip/runTurn");
  generateModule = await import("../lib/bbip/generate");
});
afterAll(() => env.cleanup());

async function collect(iter: AsyncIterable<StreamEvent>): Promise<StreamEvent[]> {
  const events: StreamEvent[] = [];
  for await (const event of iter) events.push(event);
  return events;
}

function newSession() {
  return service.createSession({
    chips: { patient: [], conditions: ["기미"], meds: [], procedures: ["피코토닝"] },
    flags: [{ level: "caution", text: "항응고 주의", source: "rule" }],
    sourceNoteIds: [],
  });
}

describe("runTurn", () => {
  it("streams a fake brief, strips followups, and stores the turn", async () => {
    const session = newSession();
    const events = await collect(runTurnModule.runTurn(session.id, { kind: "brief" }));
    expect(events[0]?.type).toBe("start");
    expect(events.at(-1)?.type).toBe("done");
    const followups = events.find((e) => e.type === "followups");
    expect(followups).toEqual({
      type: "followups",
      items: ["피코토닝 감별 포인트는?", "피코토닝 시술 간격은?", "재발 시 설명 멘트"],
    });
    const text = events.flatMap((e) => (e.type === "delta" ? [e.text] : [])).join("");
    expect(text).toContain("[FAKE 모드]");
    expect(text).not.toContain("<followups>");
    const [turn] = service.listTurns(session.id);
    expect(turn).toMatchObject({ kind: "brief", status: "done", model: "fake" });
    expect(turn!.output).not.toContain("followups");
  });

  it("records partial output and fails the turn when generation throws", async () => {
    const session = newSession();
    async function* broken(): AsyncGenerator<string> {
      yield "부분";
      throw new Error("boom");
    }
    const events = await collect(
      runTurnModule.runTurn(
        session.id,
        { kind: "custom", question: "질문" },
        { listEntries: async () => [], generate: broken }
      )
    );
    expect(events.at(-1)).toEqual({ type: "error", message: "생성 실패: boom" });
    expect(service.listTurns(session.id)[0]).toMatchObject({
      status: "failed",
      output: "부분",
      error: "boom",
    });
  });

  it("errors for an unknown session without creating a turn", async () => {
    const events = await collect(runTurnModule.runTurn("missing", { kind: "brief" }));
    expect(events).toEqual([{ type: "error", message: "세션을 찾을 수 없습니다." }]);
  });

  it("fails the turn as aborted when the consumer stops early", async () => {
    const session = newSession();
    const iter = runTurnModule.runTurn(session.id, { kind: "brief" });
    for await (const event of iter) {
      if (event.type === "delta") break;
    }
    expect(service.listTurns(session.id)[0]).toMatchObject({ status: "failed", error: "aborted" });
  });

  it("yields an error when pre-turn loading throws, without creating a turn", async () => {
    const session = newSession();
    const events = await collect(
      runTurnModule.runTurn(
        session.id,
        { kind: "brief" },
        {
          listEntries: async () => {
            throw new Error("db down");
          },
          generate: async function* () {},
        }
      )
    );
    expect(events).toEqual([{ type: "error", message: "생성 실패: db down" }]);
    expect(service.listTurns(session.id)).toHaveLength(0);
  });

  it("marks refusals as failed with a safety message and keeps partial output", async () => {
    const session = newSession();
    async function* refused(): AsyncGenerator<string> {
      yield "부분";
      yield "\n\n> **주의** 중단";
      throw new generateModule.RefusalError("refusal");
    }
    const events = await collect(
      runTurnModule.runTurn(
        session.id,
        { kind: "custom", question: "질문" },
        { listEntries: async () => [], generate: refused }
      )
    );
    expect(events.at(-1)).toEqual({ type: "error", message: "안전 정책으로 답변이 중단되었습니다." });
    const [turn] = service.listTurns(session.id);
    expect(turn).toMatchObject({ status: "failed", error: "refusal" });
    expect(turn!.output).toContain("부분");
    expect(turn!.output).toContain("중단");
  });

  it("records the model that actually served the turn", async () => {
    const session = newSession();
    async function* served(args: { onFinal?: (info: { model: string; stopReason: string | null }) => void }) {
      yield "본문";
      args.onFinal?.({ model: "claude-opus-4-8", stopReason: "end_turn" });
    }
    const events = await collect(
      runTurnModule.runTurn(session.id, { kind: "custom", question: "질문" }, { listEntries: async () => [], generate: served })
    );
    expect(events.at(-1)?.type).toBe("done");
    expect(service.listTurns(session.id)[0]).toMatchObject({ status: "done", model: "claude-opus-4-8" });
  });

  it("fails a truncated turn so it cannot be promoted or reused", async () => {
    const session = newSession();
    async function* truncated(args: { onFinal?: (info: { model: string; stopReason: string | null }) => void }) {
      yield "부분";
      yield "\n\n> **주의** 답변이 길이 제한으로 잘렸습니다.";
      args.onFinal?.({ model: "claude-opus-5-5", stopReason: "max_tokens" });
      throw new generateModule.TruncatedError();
    }
    const events = await collect(
      runTurnModule.runTurn(session.id, { kind: "custom", question: "질문" }, { listEntries: async () => [], generate: truncated })
    );
    expect(events.at(-1)).toEqual({ type: "error", message: "답변이 길이 제한으로 잘렸습니다." });
    const [turn] = service.listTurns(session.id);
    expect(turn).toMatchObject({ status: "failed", error: "truncated" });
    expect(turn!.output).toContain("길이 제한");
  });

  it("maps SDK errors to Korean messages for the card and the DB", async () => {
    const session = newSession();
    async function* limited(): AsyncGenerator<string> {
      throw Anthropic.APIError.generate(429, { type: "error", error: { type: "rate_limit_error" } }, "429 rate limited", new Headers());
    }
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const events = await collect(
      runTurnModule.runTurn(session.id, { kind: "custom", question: "질문" }, { listEntries: async () => [], generate: limited })
    );
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
    expect(events.at(-1)).toEqual({ type: "error", message: "요청이 많아 잠시 후 다시 시도해 주세요." });
    expect(service.listTurns(session.id)[0]).toMatchObject({
      status: "failed",
      error: "요청이 많아 잠시 후 다시 시도해 주세요.",
    });
  });

  it("strips phone numbers from the custom question before storing and generating", async () => {
    const session = newSession();
    let seen: string | undefined;
    async function* spy(args: { request: { question?: string } }): AsyncGenerator<string> {
      seen = args.request.question;
      yield "ok";
    }
    await collect(
      runTurnModule.runTurn(
        session.id,
        { kind: "custom", question: "010-1234-5678 환자 질문" },
        { listEntries: async () => [], generate: spy }
      )
    );
    expect(seen).toBe("환자 질문");
    expect(service.listTurns(session.id)[0]!.question).toBe("환자 질문");
  });
});

describe("aiErrorMessage", () => {
  const headers = new Headers();
  it.each([
    [Anthropic.APIError.generate(429, {}, "rate", headers), "요청이 많아 잠시 후 다시 시도해 주세요."],
    [Anthropic.APIError.generate(401, {}, "auth", headers), "API 키 설정을 확인해 주세요."],
    [Anthropic.APIError.generate(500, {}, "server", headers), "AI 서버가 혼잡합니다. 잠시 후 다시 시도해 주세요."],
    [Anthropic.APIError.generate(529, {}, "overloaded", headers), "AI 서버가 혼잡합니다. 잠시 후 다시 시도해 주세요."],
    [
      new Anthropic.APIError(undefined, { type: "error", error: { type: "overloaded_error" } }, undefined, undefined),
      "AI 서버가 혼잡합니다. 잠시 후 다시 시도해 주세요.",
    ],
    [Anthropic.APIError.generate(400, {}, "bad", headers), "AI 요청에 실패했습니다."],
    [new Anthropic.APIConnectionError({ message: "down" }), "AI 요청에 실패했습니다."],
  ])("maps %s", (error, expected) => {
    expect(runTurnModule.aiErrorMessage(error)).toBe(expected);
  });

  it("returns null for non-SDK errors", () => {
    expect(runTurnModule.aiErrorMessage(new Error("boom"))).toBeNull();
  });
});
