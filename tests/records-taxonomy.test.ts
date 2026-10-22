// tests/records-taxonomy.test.ts
import { describe, expect, it } from "vitest";
import { classifyProcedure, MAJORS, tagPath } from "../lib/records/taxonomy";

const path = (text: string) => tagPath(classifyProcedure(text));

describe("classifyProcedure", () => {
  it("sorts procedures into major › mid › minor", () => {
    expect(path("피코토닝 11회차")).toEqual(["Laser", "토닝", "피코"]);
    expect(path("레이저토닝")).toEqual(["Laser", "토닝"]);
    expect(path("프락셀")).toEqual(["Laser", "리서페이싱", "프락셀"]);
    expect(path("IPL 홍조")).toEqual(["Laser", "혈관·홍조", "IPL"]);
    expect(path("겨드랑이 제모")).toEqual(["Laser", "제모"]);
    expect(path("울쎄라 300샷")).toEqual(["Lifting", "HIFU", "울쎄라"]);
    expect(path("써마지 FLX")).toEqual(["Lifting", "RF", "써마지"]);
    expect(path("민트실 리프팅")).toEqual(["Lifting", "실리프팅", "민트실"]);
    expect(path("팔자 필러 쥬비덤")).toEqual(["Filler", "팔자", "쥬비덤"]);
    expect(path("입술 필러")).toEqual(["Filler", "입술"]);
    expect(path("필러 상담")).toEqual(["Filler"]);
    expect(path("교근 보톡스 나보타")).toEqual(["Botox", "교근·사각턱", "나보타"]);
    expect(path("미간 보톡스")).toEqual(["Botox", "이마·미간"]);
    expect(path("스킨보톡스")).toEqual(["Botox", "스킨보톡스"]);
    expect(path("쥬베룩 볼륨")).toEqual(["Stimulator", "쥬베룩 볼륨"]);
    expect(path("쥬베룩")).toEqual(["Booster", "쥬베룩"]);
    expect(path("리쥬란 힐러")).toEqual(["Booster", "리쥬란"]);
    expect(path("리투오")).toEqual(["Booster", "리투오"]);
    expect(path("아쿠아필")).toEqual(["Skin care", "필링"]);
    expect(path("상담")).toEqual(["Other"]);
  });

  it("gives every major a label and distinct colors", () => {
    const keys = MAJORS.map((m) => m.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(MAJORS.map((m) => m.color.dot)).size).toBe(MAJORS.length);
    for (const m of MAJORS) expect(m.ko.length).toBeGreaterThan(0);
  });
});
