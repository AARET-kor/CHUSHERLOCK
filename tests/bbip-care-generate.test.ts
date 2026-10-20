// tests/bbip-care-generate.test.ts
import { describe, expect, it, vi } from "vitest";
import { CareGenerationError } from "../lib/bbip/care/errors";
import { buildCareParams, callCareModel, fakeCareResponse } from "../lib/bbip/care/generate";
import { parseCareResponse } from "../lib/bbip/care/parse";
import { CARE_SCHEMA, type CareContext } from "../lib/bbip/care/prompt";
import { FALLBACK_BETA } from "../lib/bbip/models";

const context: CareContext = {
  system: [{ type: "text", text: "s" }],
  messages: [{ role: "user", content: "u" }],
};

describe("care model call", () => {
  it("asks for structured JSON at medium effort with the server fallback on Opus 5.5", () => {
    const params = buildCareParams(context, "claude-opus-5-5");
    expect(params.model).toBe("claude-opus-5-5");
    expect(params.max_tokens).toBe(16000);
    expect(params.output_config).toEqual({ effort: "medium", format: { type: "json_schema", schema: CARE_SCHEMA } });
    expect(params.betas).toEqual([FALLBACK_BETA]);
    expect(params.fallbacks).toBe("default");
    const old = buildCareParams(context, "claude-haiku-4-5");
    expect(old.output_config).toEqual({ format: { type: "json_schema", schema: CARE_SCHEMA } });
    expect(old.betas).toBeUndefined();
  });

  it("returns the caller's text and maps refusal and truncation to Korean errors", async () => {
    const ok = vi.fn(async () => ({ text: "{}", model: "claude-opus-5-5", stopReason: "end_turn" }));
    expect(await callCareModel(context, ok)).toEqual({ text: "{}", model: "claude-opus-5-5", stopReason: "end_turn" });
    expect(ok).toHaveBeenCalledWith(expect.objectContaining({ system: context.system, messages: context.messages }));
    await expect(callCareModel(context, async () => ({ text: "", model: "m", stopReason: "refusal" }))).rejects.toThrow(
      "안전 정책으로 오더 작성이 중단되었습니다."
    );
    await expect(
      callCareModel(context, async () => ({ text: "", model: "m", stopReason: "max_tokens" }))
    ).rejects.toBeInstanceOf(CareGenerationError);
  });

  it("fake response covers all four kinds, and adds nothing when a set exists", () => {
    const ctx = { notes: [], setIds: new Set<string>() };
    expect(parseCareResponse(fakeCareResponse(false), ctx).items.map((i) => i.kind)).toEqual([
      "rx",
      "dressing",
      "contingency",
      "followup",
    ]);
    const withSet = parseCareResponse(fakeCareResponse(true), ctx);
    expect(withSet.items).toEqual([]);
    expect(withSet.caution).toContain("FAKE");
  });
});
