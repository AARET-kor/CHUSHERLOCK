// tests/papers-select.test.ts
import { describe, expect, it } from "vitest";
import { pickForConsult, pickWeekly, type ConsultCandidate, type QueueItem } from "../lib/papers/select";

const q = (pmid: string, topics: QueueItem["topics"], impactFactor: number | null, year = 2024, attempts = 0, hasFullText = true): QueueItem => ({
  pmid,
  topics,
  impactFactor,
  year,
  attempts,
  hasFullText,
});

describe("pickWeekly", () => {
  it("takes the best paper of each topic first, then fills by IF", () => {
    const picks = pickWeekly(
      [
        q("1", ["filler"], 11),
        q("2", ["filler"], 10),
        q("3", ["filler"], 9),
        q("4", ["pigment"], 8),
        q("5", ["thread"], 1.4),
        q("6", ["energy"], 2),
      ],
      5
    );
    expect(picks).toEqual(["1", "5", "6", "4", "2"]);
  });

  it("orders ties by newest year, puts unknown IF last, and never exceeds the limit", () => {
    expect(pickWeekly([q("1", ["filler"], null, 2026), q("2", ["filler"], 3, 2020), q("3", ["filler"], 3, 2025)], 2)).toEqual(["3", "2"]);
    expect(pickWeekly([q("1", ["filler"], 3)], 0)).toEqual([]);
  });

  it("prefers full text over IF, because analyses are never redone", () => {
    const paywalled = q("1", ["filler"], 11.8, 2026, 0, false);
    const open = q("2", ["filler"], 2, 2020);
    expect(pickWeekly([paywalled, open], 1)).toEqual(["2"]);
    expect(pickWeekly([paywalled, open], 2)).toEqual(["2", "1"]);
  });

  it("still gives a topic its paper when only abstracts exist", () => {
    expect(pickWeekly([q("1", ["filler"], 9), q("2", ["thread"], 1, 2024, 0, false)], 2)).toEqual(["1", "2"]);
  });

  it("stops retrying a paper after three failed attempts", () => {
    expect(pickWeekly([q("1", ["filler"], 9, 2024, 3), q("2", ["filler"], 1)], 5)).toEqual(["2"]);
  });

  it("does not pick one paper twice when it has two topics", () => {
    expect(pickWeekly([q("1", ["thread", "energy"], 5), q("2", ["energy"], 4)], 5)).toEqual(["1", "2"]);
  });
});

const c = (over: Partial<ConsultCandidate> & { pmid: string }): ConsultCandidate => ({
  analyzed: false,
  subjectKind: null,
  level: "other",
  impactFactor: null,
  year: 2024,
  reviewStatus: "unreviewed",
  ...over,
});

describe("pickForConsult", () => {
  it("prefers analyzed, then human, then evidence level, then IF", () => {
    const picks = pickForConsult(
      [
        c({ pmid: "unanalyzed", level: "guideline", impactFactor: 11 }),
        c({ pmid: "rat", analyzed: true, subjectKind: "animal", level: "other", impactFactor: 11 }),
        c({ pmid: "human-low-if", analyzed: true, subjectKind: "human", level: "observational", impactFactor: 1.5 }),
        c({ pmid: "human-rct", analyzed: true, subjectKind: "human", level: "rct", impactFactor: 2 }),
      ],
      5
    );
    expect(picks).toEqual(["human-rct", "human-low-if", "rat", "unanalyzed"]);
  });

  it("leaves out excluded papers and respects the limit", () => {
    const picks = pickForConsult(
      [c({ pmid: "a", reviewStatus: "excluded", analyzed: true }), c({ pmid: "b" }), c({ pmid: "c", impactFactor: 3 })],
      1
    );
    expect(picks).toEqual(["c"]);
  });
});
