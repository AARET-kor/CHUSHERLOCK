import { describe, expect, it } from "vitest";
import { newCardState, schedule, dueLabel, type CardState } from "../lib/srs/scheduler";

describe("SRS scheduler (SM-2 + learning steps)", () => {
  it("a new card walks the learning steps on Good, then graduates to review at 1 day", () => {
    let card: CardState = newCardState();
    expect(card.status).toBe("learning");

    let r = schedule(card, "good"); // step 0 → 1
    expect(r.status).toBe("learning");
    expect(r.learningStep).toBe(1);
    expect(r.dueInMinutes).toBe(10);

    r = schedule(r, "good"); // past last step → graduate
    expect(r.status).toBe("review");
    expect(r.intervalDays).toBe(1);
    expect(r.reps).toBe(1);
    expect(r.dueInMinutes).toBe(1 * 1440);
  });

  it("Again in learning resets to the first step", () => {
    const card = { ...newCardState(), learningStep: 1 };
    const r = schedule(card, "again");
    expect(r.learningStep).toBe(0);
    expect(r.dueInMinutes).toBe(1);
  });

  it("Easy graduates a new card immediately at the easy interval", () => {
    const r = schedule(newCardState(), "easy");
    expect(r.status).toBe("review");
    expect(r.intervalDays).toBe(4);
  });

  it("intervals grow daily → weekly → monthly across successful reviews", () => {
    // graduate first
    let r = schedule(schedule(newCardState(), "good"), "good");
    expect(r.intervalDays).toBe(1); // daily
    r = schedule(r, "good");
    expect(r.intervalDays).toBe(6); // weekly-ish
    r = schedule(r, "good");
    expect(r.intervalDays).toBe(15); // 6 * 2.5
    r = schedule(r, "good");
    expect(r.intervalDays).toBe(38); // ~monthly (15 * 2.5)
    // each step is strictly larger
    const seq = [1, 6, 15, 38];
    for (let i = 1; i < seq.length; i++) expect(seq[i]!).toBeGreaterThan(seq[i - 1]!);
  });

  it("Again in review lapses the card: relearn, ease drops, lapses increments", () => {
    const review: CardState = {
      status: "review",
      learningStep: 0,
      easeMilli: 2500,
      intervalDays: 40,
      reps: 5,
      lapses: 0,
    };
    const r = schedule(review, "again");
    expect(r.status).toBe("lapsed");
    expect(r.lapses).toBe(1);
    expect(r.easeMilli).toBe(2300); // -200
    expect(r.dueInMinutes).toBe(10); // relearn step
    expect(r.intervalDays).toBe(1); // restored short interval
  });

  it("Hard grows slowly and lowers ease; Easy grows fast and raises ease", () => {
    const review: CardState = {
      status: "review",
      learningStep: 0,
      easeMilli: 2500,
      intervalDays: 10,
      reps: 3,
      lapses: 0,
    };
    const hard = schedule(review, "hard");
    expect(hard.easeMilli).toBe(2350);
    expect(hard.intervalDays).toBe(12); // 10 * 1.2

    const easy = schedule(review, "easy");
    expect(easy.easeMilli).toBe(2650);
    expect(easy.intervalDays).toBeGreaterThan(hard.intervalDays);
  });

  it("ease never drops below the 1.3 floor", () => {
    let card: CardState = {
      status: "review",
      learningStep: 0,
      easeMilli: 1400,
      intervalDays: 5,
      reps: 3,
      lapses: 0,
    };
    card = schedule(card, "again"); // -200 would go to 1200, clamps to 1300
    expect(card.easeMilli).toBe(1300);
  });

  it("dueLabel renders human intervals", () => {
    expect(dueLabel(30)).toContain("세션");
    expect(dueLabel(1440)).toBe("내일");
    expect(dueLabel(3 * 1440)).toBe("3일 후");
    expect(dueLabel(14 * 1440)).toBe("2주 후");
    expect(dueLabel(60 * 1440)).toBe("2개월 후");
  });
});
