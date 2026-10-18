// tests/bbip-models.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const KEYS = [
  "CODEX_AI_MODEL",
  "CODEX_AI_MODEL_MID",
  "CODEX_AI_MODEL_LIGHT",
  "BBIP_BRIEF_MODEL",
  "BBIP_BRIEF_EFFORT",
  "BBIP_FALLBACK_MODEL",
];
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
  vi.resetModules();
});

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  vi.resetModules();
});

describe("model defaults", () => {
  it("uses the Claude 5.5 family when no override is set", async () => {
    const client = await import("../lib/ai/client");
    expect(client.MODEL).toBe("claude-opus-5-5");
    expect(client.MID_MODEL).toBe("claude-sonnet-5-5");
    expect(client.LIGHT_MODEL).toBe("claude-haiku-5-5");
  });
});

describe("modelForRequest", () => {
  it("routes brief to low-effort Opus, safety sections to Opus, others to Sonnet", async () => {
    const { modelForRequest } = await import("../lib/bbip/models");
    expect(modelForRequest({ kind: "brief" })).toEqual({ model: "claude-opus-5-5", effort: "low" });
    expect(modelForRequest({ kind: "section", sectionKey: "ddx" })).toEqual({
      model: "claude-opus-5-5",
      effort: "medium",
    });
    expect(modelForRequest({ kind: "section", sectionKey: "marketing" }).model).toBe(
      "claude-sonnet-5-5"
    );
    expect(modelForRequest({ kind: "custom", question: "질문" }).model).toBe("claude-opus-5-5");
  });

  it("honours brief overrides", async () => {
    process.env.BBIP_BRIEF_MODEL = "claude-sonnet-5-5";
    process.env.BBIP_BRIEF_EFFORT = "medium";
    const { modelForRequest } = await import("../lib/bbip/models");
    expect(modelForRequest({ kind: "brief" })).toEqual({
      model: "claude-sonnet-5-5",
      effort: "medium",
    });
  });

  it("knows which models reject the effort parameter", async () => {
    const { supportsEffort } = await import("../lib/bbip/models");
    expect(supportsEffort("claude-haiku-5-5")).toBe(true);
    expect(supportsEffort("claude-opus-5-5")).toBe(true);
    expect(supportsEffort("claude-haiku-4-5")).toBe(false);
    expect(supportsEffort("claude-sonnet-4-5")).toBe(false);
  });
});
