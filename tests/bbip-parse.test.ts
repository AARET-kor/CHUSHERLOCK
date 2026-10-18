// tests/bbip-parse.test.ts
import { describe, expect, it } from "vitest";
import { fallbackParse, parseCase, sanitizeInput, type ParseCaller } from "../lib/bbip/parse";

describe("sanitizeInput", () => {
  it("removes phone numbers and resident registration numbers", () => {
    const clean = sanitizeInput("김OO 010-1234-5678 900101-2345678 기미");
    expect(clean).not.toMatch(/010|2345678/);
    expect(clean).toContain("기미");
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
});
