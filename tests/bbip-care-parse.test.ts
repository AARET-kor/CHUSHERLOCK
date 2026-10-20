// tests/bbip-care-parse.test.ts
import { describe, expect, it } from "vitest";
import { CareGenerationError } from "../lib/bbip/care/errors";
import { parseCareResponse, resolveCite } from "../lib/bbip/care/parse";
import type { LiteratureBlock } from "../lib/bbip/types";

const literature: LiteratureBlock = {
  pubmedQuery: "q",
  webQuery: "w",
  papers: [{ pmid: "1", title: "t", authors: [], journal: "J", abstract: "", publicationTypes: [], level: "meta" }],
  web: [{ url: "https://fda.gov/", title: "t", snippet: "" }],
  errors: {},
  fetchedAt: "",
};
const ctx = {
  notes: [
    { n: 2, verified: true },
    { n: 3, verified: false },
  ],
  literature,
  setIds: new Set(["set-1", "set-2"]),
};
const blank = {
  drug: "", brand: "", form: "", dose: "", frequency: "", duration: "", purpose: "",
  material: "", method: "", interval: "", situation: "", signs: "", action: "", resolution: "",
  urgency: "", day: 0, when: "", checks: "", next: "", patientText: "", cite: "AI",
};

describe("resolveCite", () => {
  it.each([
    ["2", { source: "note", cite: "2" }],
    ["3", { source: "ai" }],
    ["9", { source: "ai" }],
    ["P1", { source: "literature", cite: "P1" }],
    ["p1", { source: "literature", cite: "P1" }],
    ["W1", { source: "literature", cite: "W1" }],
    ["W2", { source: "ai" }],
    ["AI", { source: "ai" }],
  ])("%s", (cite, expected) => {
    expect(resolveCite(cite, ctx)).toEqual(expected);
  });
});

describe("parseCareResponse", () => {
  it("maps flat rows to kind fields with sources", () => {
    const text = JSON.stringify({
      caution: " 아스피린 — NSAID 피하기 ",
      items: [
        { ...blank, kind: "rx", drug: "mupirocin", form: "2% 연고", dose: "얇게", frequency: "1일 3회", duration: "5일", material: "x", cite: "2", patientText: "바르세요." },
        { ...blank, kind: "followup", day: 7, when: "D+7", checks: "홍반", cite: "P1" },
        { ...blank, kind: "followup", day: -3, when: "D+1", checks: "부종" },
      ],
      remove: [],
    });
    const parsed = parseCareResponse(text, ctx);
    expect(parsed.caution).toBe("아스피린 — NSAID 피하기");
    expect(parsed.dropped).toBe(0);
    expect(parsed.items[0]).toMatchObject({
      kind: "rx",
      fields: { drug: "mupirocin", brand: "", form: "2% 연고", dose: "얇게", frequency: "1일 3회", duration: "5일", purpose: "" },
      patientText: "바르세요.",
      source: "note",
      cite: "2",
      confirmed: false,
    });
    expect(parsed.items[0]!.fields).not.toHaveProperty("material");
    expect(parsed.items[1]).toMatchObject({ fields: { day: "7", when: "D+7" }, source: "literature", cite: "P1" });
    expect(parsed.items[2]!.fields.day).toBe("");
  });

  it("drops rows with a bad kind or an empty primary field and counts them", () => {
    const parsed = parseCareResponse(
      JSON.stringify({
        caution: "",
        items: [{ ...blank, kind: "surgery", drug: "x" }, { ...blank, kind: "rx", drug: " " }, { ...blank, kind: "dressing", material: "거즈", method: "덮기" }],
        remove: [],
      }),
      ctx
    );
    expect(parsed.dropped).toBe(2);
    expect(parsed.items.map((i) => i.kind)).toEqual(["dressing"]);
  });

  it("keeps removals only for known set rows", () => {
    const parsed = parseCareResponse(
      JSON.stringify({
        caution: "",
        items: [],
        remove: [
          { id: "set-1", reason: "임신" },
          { id: "nope", reason: "x" },
          { id: "set-1", reason: "중복" },
          { id: "set-2", reason: " " },
        ],
      }),
      ctx
    );
    expect(Array.from(parsed.removals.entries())).toEqual([
      ["set-1", "임신"],
      ["set-2", "이 케이스에 맞지 않음"],
    ]);
  });

  it("rejects text that is not JSON", () => {
    expect(() => parseCareResponse("not json", ctx)).toThrow(CareGenerationError);
  });
});
