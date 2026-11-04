// tests/papers-note.test.ts
import { describe, expect, it } from "vitest";
import { emphasize, splitSentences } from "../lib/papers/note";

const strong = (text: string) =>
  emphasize(text)
    .filter((part) => part.strong)
    .map((part) => part.text);

describe("splitSentences", () => {
  it("splits Korean sentences at their endings", () => {
    expect(splitSentences("비교 연구가 아니라 권고안이다. 증례 2는 Teosyal을 사용했다. 저자 자문위원회는 설립됨.")).toEqual([
      "비교 연구가 아니라 권고안이다.",
      "증례 2는 Teosyal을 사용했다.",
      "저자 자문위원회는 설립됨.",
    ]);
  });

  it("leaves abbreviations and decimals alone", () => {
    const text = "Smith et al. 2020 대비 0.5 cc 사용, Teosyal vs. Restylane 비교.";
    expect(splitSentences(text)).toEqual([text]);
  });

  it("returns nothing for empty text", () => {
    expect(splitSentences("   ")).toEqual([]);
  });
});

describe("emphasize", () => {
  it("never changes the text itself", () => {
    const text = "증례 1(2명): 2년 전 시술, ≤0.5 cc, hyaluronidase 15 IU로 해소.";
    expect(emphasize(text).map((part) => part.text).join("")).toBe(text);
  });

  it("marks a short lead-in before a colon", () => {
    expect(strong("증례 2(1명): 부종이 생겼다")).toEqual(["증례 2(1명):"]);
  });

  it("ignores a colon too far into the sentence", () => {
    const text = "안와하 HA 필러 임상시험 메타분석에서 캐뉼라가 바늘보다 부종 발생률이 높았다는 결론: 유의함";
    expect(strong(text)).toEqual([]);
  });

  it("marks doses, ranges and intervals with their units", () => {
    expect(strong("11-24%에서 보고, 총량 ≤0.5 cc, 2-3주 관찰, 최대 3회, triamcinolone 10 mg/mL")).toEqual([
      "11-24%",
      "≤0.5 cc",
      "2-3주",
      "3회",
      "10 mg/mL",
    ]);
  });

  it("marks sample sizes", () => {
    expect(strong("대상은 n=42 였다")).toEqual(["n=42"]);
  });

  it("leaves bare numbers and years alone", () => {
    expect(strong("증례 3 및 Figure 2, 2020 문헌")).toEqual([]);
  });

  it("leaves calendar years alone but keeps durations", () => {
    expect(strong("2020년 이후, 2020-2025년 문헌, 2년 전 시술")).toEqual(["2년"]);
  });

  it("does not take a unit out of a longer word", () => {
    expect(strong("Grade 2 mm 아님 3 millimeter")).toEqual(["2 mm"]);
  });
});
