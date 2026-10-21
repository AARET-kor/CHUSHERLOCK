// tests/records-chart.test.ts
import { describe, expect, it } from "vitest";
import { extractChartNo, normalizeChartNo } from "../lib/records/chart";
import { featuresFromChips } from "../lib/records/features";
import { ANGLES, SCORE_KINDS } from "../lib/records/types";

describe("extractChartNo", () => {
  it("takes #number out of the memo and normalizes it", () => {
    expect(extractChartNo("#20431 40대 여성 기미 피코토닝")).toEqual({ chartNo: "20431", rest: "40대 여성 기미 피코토닝" });
    expect(extractChartNo("40대 여성, #a-1023, 필러")).toEqual({ chartNo: "A-1023", rest: "40대 여성, 필러" });
    expect(extractChartNo("팔자 필러 #7788")).toEqual({ chartNo: "7788", rest: "팔자 필러" });
  });

  it("ignores hashtags without a digit, too-short numbers and plain numbers", () => {
    expect(extractChartNo("#기미 #abc 피코").chartNo).toBeNull();
    expect(extractChartNo("#12 필러").chartNo).toBeNull();
    expect(extractChartNo("20431 필러").chartNo).toBeNull();
    expect(extractChartNo("필러 상담").rest).toBe("필러 상담");
  });

  it("normalizes typed chart numbers", () => {
    expect(normalizeChartNo(" #a-12 ")).toBe("A-12");
  });
});

describe("featuresFromChips", () => {
  it("joins patient, top conditions and meds", () => {
    expect(
      featuresFromChips({ patient: ["40대 여성"], conditions: ["기미", "홍조", "모공"], meds: ["와파린"], procedures: ["피코토닝"] })
    ).toBe("40대 여성 · 기미 · 홍조 · 와파린");
    expect(featuresFromChips({ patient: [], conditions: [], meds: [], procedures: ["필러"] })).toBe("");
  });
});

describe("vocabulary", () => {
  it("has six angles and bounded score kinds", () => {
    expect(ANGLES).toEqual(["front", "left45", "right45", "left", "right", "close"]);
    expect(SCORE_KINDS.mmasi).toMatchObject({ min: 0, max: 24, better: "lower" });
    expect(SCORE_KINDS.none.better).toBeNull();
  });
});
