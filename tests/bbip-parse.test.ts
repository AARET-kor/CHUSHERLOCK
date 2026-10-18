// tests/bbip-parse.test.ts
import { afterEach, describe, expect, it } from "vitest";
import {
  fallbackParse,
  normalizeChips,
  parseCase,
  sanitizeInput,
  type ParseCaller,
} from "../lib/bbip/parse";

const originalMode = process.env.CODEX_AI_MODE;
afterEach(() => {
  if (originalMode === undefined) delete process.env.CODEX_AI_MODE;
  else process.env.CODEX_AI_MODE = originalMode;
});

describe("sanitizeInput", () => {
  it("removes phone numbers and resident registration numbers", () => {
    const clean = sanitizeInput("김OO 010-1234-5678 900101-2345678 기미");
    expect(clean).not.toMatch(/010|2345678/);
    expect(clean).toContain("기미");
  });

  it("removes unseparated, foreigner and +82 numbers without leftovers", () => {
    expect(sanitizeInput("9001012345678 기미").trim()).toBe("기미");
    expect(sanitizeInput("900101-5234567 기미").trim()).toBe("기미");
    expect(sanitizeInput("+82 10-1234-5678 기미").trim()).toBe("기미");
  });
});

describe("normalizeChips", () => {
  it("drops chips that are empty after sanitizing", () => {
    const chips = normalizeChips({
      patient: ["010-1234-5678", "40대 여성"],
      conditions: [],
      meds: [],
      procedures: [],
    });
    expect(chips.patient).toEqual(["40대 여성"]);
  });
});

describe("fallbackParse", () => {
  it("splits on commas and buckets by keyword", () => {
    expect(fallbackParse("40대 여성, 기미, 아스피린 복용, 피코토닝 희망")).toEqual({
      patient: ["40대 여성"],
      conditions: ["기미"],
      meds: ["아스피린"],
      procedures: ["피코토닝"],
    });
  });
});

describe("parseCase", () => {
  it("merges model flags with rule flags", async () => {
    const caller: ParseCaller = async () => ({
      chips: { patient: [], conditions: [], meds: ["아스피린"], procedures: ["필러"] },
      flags: [{ level: "caution", text: "멍 설명" }],
    });
    const result = await parseCase("아스피린, 필러", caller);
    expect(result.degraded).toBe(false);
    expect(result.flags.map((f) => f.source)).toEqual(["rule", "model"]);
  });

  it("falls back to keyword split when the caller fails", async () => {
    const caller: ParseCaller = async () => {
      throw new Error("down");
    };
    const result = await parseCase("40대 여성, 로아큐탄 복용, 레이저토닝", caller);
    expect(result.degraded).toBe(true);
    expect(result.chips.procedures).toEqual(["레이저토닝"]);
    expect(result.flags[0]?.level).toBe("contraindication");
  });

  it("uses the offline parser in fake mode by default", async () => {
    process.env.CODEX_AI_MODE = "fake";
    const result = await parseCase("기미, 피코토닝 희망");
    expect(result.chips.procedures).toEqual(["피코토닝"]);
    expect(result.degraded).toBe(false);
  });

  it("caps model flags: drops empty, max 6, 120 chars each", async () => {
    const flags = [
      { level: "caution" as const, text: "   " },
      ...Array.from({ length: 10 }, (_, i) => ({ level: "caution" as const, text: `f${i}${"x".repeat(200)}` })),
    ];
    const caller: ParseCaller = async () => ({
      chips: { patient: [], conditions: [], meds: [], procedures: [] },
      flags,
    });
    const result = await parseCase("기미", caller);
    const model = result.flags.filter((f) => f.source === "model");
    expect(model).toHaveLength(6);
    expect(model.every((f) => f.text.length <= 120)).toBe(true);
  });
});
