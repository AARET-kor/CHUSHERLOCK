// tests/bbip-anatomy-regions.test.ts
import { describe, expect, it } from "vitest";
import { buildAtlasBlock } from "../lib/bbip/anatomy/prompt";
import { anatomyPlanFor, detectCategories, detectRegions, regionStructures } from "../lib/bbip/anatomy/regions";
import type { ParsedCase } from "../lib/bbip/types";

const chips = (procedures: string[], conditions: string[] = []): ParsedCase => ({
  patient: [], conditions, meds: [], procedures,
});

describe("detectCategories", () => {
  it("classifies injectable procedures", () => {
    expect(detectCategories(["팔자 필러"])).toEqual(["face-filler"]);
    expect(detectCategories(["필러 용해"])).toEqual(["filler-dissolving"]);
    expect(detectCategories(["쥬베룩 볼륨"])).toEqual(["collagen-stimulator"]);
    expect(detectCategories(["쥬베룩"])).toEqual(["skin-booster"]);
    expect(detectCategories(["엘란쎄", "스컬트라"])).toEqual(["collagen-stimulator"]);
    expect(detectCategories(["민트실 리프팅"])).toEqual(["thread-lifting"]);
    expect(detectCategories(["리쥬란 힐러"])).toEqual(["skin-booster"]);
    expect(detectCategories(["사각턱 보톡스"])).toEqual(["botox"]);
  });

  it("ignores non-injection procedures", () => {
    expect(detectCategories(["피코토닝", "울쎄라", "엑소좀 MTS", "스킨보톡스", "다한증 보톡스"])).toEqual([]);
  });
});

describe("detectRegions", () => {
  it("maps Korean region words without false hits", () => {
    expect(detectRegions(["눈밑 필러"])).toEqual(["tear-trough"]);
    expect(detectRegions(["팔자주름"])).toEqual(["nasolabial"]);
    expect(detectRegions(["코필러"])).toEqual(["nose"]);
    expect(detectRegions(["피코토닝", "코그실"])).toEqual([]);
    expect(detectRegions(["쥬베룩 볼륨"])).toEqual([]);
    expect(detectRegions(["앞광대", "볼꺼짐"])).toEqual(["midface"]);
    expect(detectRegions(["이마", "관자", "입술", "턱끝"])).toEqual([
      "forehead-glabella", "temple", "lips", "chin-jawline",
    ]);
  });
});

describe("anatomyPlanFor", () => {
  it("recognizes eye and masseter aliases instead of falling back to forehead", () => {
    for (const name of ["눈가 보톡스", "눈꼬리 보톡스", "crow's feet botox", "orbicularis oculi botox"]) {
      const plan = anatomyPlanFor(chips([name]))!;
      expect(plan.regions).toEqual(["tear-trough"]);
      expect(regionStructures(plan.regions[0]!, plan).some((s) => s.id === "orbicularis-oculi")).toBe(true);
    }
    for (const name of ["교근 보톡스", "masseter botox"]) {
      expect(anatomyPlanFor(chips([name]))?.regions).toEqual(["chin-jawline"]);
    }
  });
  it("maps muscle names to their regions", () => {
    expect(detectRegions(["frontalis botox"])).toEqual(["forehead-glabella"]);
    expect(detectRegions(["corrugator", "procerus"])).toEqual(["forehead-glabella"]);
    expect(detectRegions(["zygomaticus"])).toEqual(["midface"]);
    expect(detectRegions(["DAO 보톡스"])).toEqual(["lips"]);
    expect(detectRegions(["depressor anguli oris"])).toEqual(["lips"]);
  });

  it("marks default regions as a guess, and guesses botox across its usual sites", () => {
    expect(anatomyPlanFor(chips(["사각턱 보톡스"]))?.regionsGuessed).toBe(false);
    const plan = anatomyPlanFor(chips(["보톡스"]))!;
    expect(plan.regionsGuessed).toBe(true);
    expect(plan.regions).toEqual(["forehead-glabella", "tear-trough", "lips", "chin-jawline"]);
    expect(buildAtlasBlock(plan)).toContain("부위 미확인");
    expect(buildAtlasBlock(anatomyPlanFor(chips(["사각턱 보톡스"])))).not.toContain("부위 미확인");
  });

  it("returns null when no procedure maps to the atlas", () => {
    expect(anatomyPlanFor(chips(["피코토닝"], ["기미"]))).toBeNull();
  });

  it("uses region words from procedures and conditions", () => {
    expect(anatomyPlanFor(chips(["필러"], ["팔자주름"]))).toEqual({
      categories: ["face-filler"], regions: ["nasolabial"], muscleOnly: false, regionsGuessed: false,
    });
  });

  it("falls back to category default regions", () => {
    expect(anatomyPlanFor(chips(["실리프팅"]))?.regions).toEqual(["midface", "chin-jawline", "temple"]);
    expect(anatomyPlanFor(chips(["필러"]))?.regions).toHaveLength(8);
  });

  it("shows only the muscle layer for botox-only cases", () => {
    const plan = anatomyPlanFor(chips(["사각턱 보톡스"]))!;
    expect(plan).toEqual({ categories: ["botox"], regions: ["chin-jawline"], muscleOnly: true, regionsGuessed: false });
    expect(regionStructures("chin-jawline", plan).every((s) => s.layer === "muscles")).toBe(true);
  });

  it("limits entry points to the case's categories", () => {
    const plan = anatomyPlanFor(chips(["실리프팅"], ["관자"]))!;
    const entries = regionStructures("temple", plan).filter((s) => s.layer === "entry");
    expect(entries.map((s) => s.id)).toEqual(["entry-thread-temple"]);
  });
});
