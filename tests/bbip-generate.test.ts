// tests/bbip-generate.test.ts
import { describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import {
  buildStreamParams,
  fakeTurnText,
  RefusalError,
  streamTurnText,
  TruncatedError,
  type GenerateArgs,
  type TurnStream,
} from "../lib/bbip/generate";
import type { BbipSession } from "../lib/bbip/types";

const session: BbipSession = {
  id: "s",
  chips: { patient: [], conditions: ["기미"], meds: [], procedures: ["피코토닝"] },
  flags: [],
  sourceNoteIds: [],
  promptVersion: "bbip-v2",
  createdAt: "2026-01-01T00:00:00.000Z",
};

function args(extra: Partial<GenerateArgs> = {}): GenerateArgs {
  return { session, entries: [], priorTurns: [], request: { kind: "brief" }, ...extra };
}

function fakeStream(
  texts: string[],
  final: { model: string; stop_reason: Anthropic.Beta.BetaStopReason | null }
): TurnStream {
  return {
    async *[Symbol.asyncIterator]() {
      for (const text of texts) {
        yield {
          type: "content_block_delta",
          index: 0,
          delta: { type: "text_delta", text },
        } as Anthropic.Beta.BetaRawMessageStreamEvent;
      }
    },
    finalMessage: async () => final,
  };
}

async function drain(iter: AsyncIterable<string>): Promise<{ text: string; error?: unknown }> {
  let text = "";
  try {
    for await (const chunk of iter) text += chunk;
  } catch (error) {
    return { text, error };
  }
  return { text };
}

describe("buildStreamParams", () => {
  const context = { system: [], messages: [] };

  it.each(["claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5"])(
    "uses the server-side default fallback for %s",
    (model) => {
      const params = buildStreamParams(args(), context, { model, effort: "low" });
      expect(params.betas).toEqual(["server-side-fallback-2026-07-01"]);
      expect(params.fallbacks).toBe("default");
    }
  );

  it.each(["claude-haiku-5-5", "claude-sonnet-5", "claude-opus-4-8", "anthropic.claude-opus-5-5"])(
    "sends no fallback for %s",
    (model) => {
      const params = buildStreamParams(args(), context, { model, effort: "low" });
      expect(params.betas).toBeUndefined();
      expect(params.fallbacks).toBeUndefined();
    }
  );
});

describe("streamTurnText", () => {
  it("reports the model that actually served the turn", async () => {
    let info: { model: string; stopReason: string | null } | undefined;
    const out = await drain(
      streamTurnText(
        args({ onFinal: (i) => (info = i) }),
        () => fakeStream(["안녕", "하세요"], { model: "claude-opus-4-8", stop_reason: "end_turn" })
      )
    );
    expect(out).toEqual({ text: "안녕하세요" });
    expect(info).toEqual({ model: "claude-opus-4-8", stopReason: "end_turn" });
  });

  it("appends a truncation note and throws TruncatedError on max_tokens", async () => {
    let info: { model: string; stopReason: string | null } | undefined;
    const out = await drain(
      streamTurnText(
        args({ onFinal: (i) => (info = i) }),
        () => fakeStream(["부분"], { model: "claude-opus-5-5", stop_reason: "max_tokens" })
      )
    );
    expect(out.text).toBe("부분\n\n> **주의** 답변이 길이 제한으로 잘렸습니다.");
    expect(out.error).toBeInstanceOf(TruncatedError);
    expect(info?.stopReason).toBe("max_tokens");
  });

  it("still throws RefusalError on refusal", async () => {
    const out = await drain(
      streamTurnText(args(), () => fakeStream(["x"], { model: "claude-opus-5-5", stop_reason: "refusal" }))
    );
    expect(out.error).toBeInstanceOf(RefusalError);
  });
});

describe("fakeTurnText", () => {
  it("fake literature text cites P1/W1 only when the session has them", () => {
    const lit = {
      pubmedQuery: "q",
      webQuery: "w",
      errors: {},
      fetchedAt: "",
      papers: [{ pmid: "1", title: "t", authors: [], journal: "", abstract: "", publicationTypes: [], level: "rct" as const }],
      web: [{ url: "https://fda.gov/", title: "t", snippet: "" }],
    };
    const withLit = fakeTurnText(args({ session: { ...session, literature: lit }, request: { kind: "literature" } }));
    expect(withLit).toContain("문헌 근거 (FAKE)");
    expect(withLit).toContain("[P1]");
    expect(withLit).toContain("[W1]");
    const without = fakeTurnText(args({ request: { kind: "literature" } }));
    expect(without).not.toContain("[P1]");
  });
});
