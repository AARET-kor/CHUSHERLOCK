// tests/papers-topics.test.ts
import { describe, expect, it } from "vitest";
import { topicsForCase, topicTerm } from "../lib/papers/topics";

const chips = (procedures: string[], conditions: string[] = []) => ({ patient: [], conditions, meds: [], procedures });

describe("topicTerm", () => {
  it("limits a topic to the journal list and an entry-date window", () => {
    const term = topicTerm("thread", ["Aesthet Surg J", "Dermatol Surg"], "2021/11/04");
    expect(term).toContain('"thread lift"[tiab]');
    expect(term).toContain('("Aesthet Surg J"[ta] OR "Dermatol Surg"[ta])');
    expect(term).toContain('("2021/11/04"[edat] : "3000"[edat])');
  });

  it("only counts hyaluronidase when the paper is about fillers", () => {
    expect(topicTerm("filler", ["J"], "2021/11/04")).toContain('hyaluronidase[tiab] AND (filler*[tiab]');
  });
});

describe("topicsForCase", () => {
  it.each([
    [["팔자 필러 쥬비덤"], [], ["filler"]],
    [["필러 용해"], [], ["filler"]],
    [["민트실 리프팅"], [], ["thread"]],
    [["울쎄라"], [], ["energy"]],
    [["써마지 FLX"], [], ["energy"]],
    [["리프팅 상담"], [], ["thread", "energy"]],
    [["피코토닝"], [], ["pigment"]],
    [["큐스위치 점빼기"], [], ["pigment"]],
    [["상담"], ["기미"], ["pigment"]],
    [["교근 보톡스"], [], []],
    [["IPL 홍조"], [], []],
  ])("%j %j → %j", (procedures, conditions, expected) => {
    expect(topicsForCase(chips(procedures, conditions))).toEqual(expected);
  });
});
