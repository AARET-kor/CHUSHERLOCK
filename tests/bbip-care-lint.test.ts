// tests/bbip-care-lint.test.ts
import { describe, expect, it } from "vitest";
import { caseText, INTERACTION_RULES, interactionsFor } from "../lib/bbip/care/interactions";
import { AI_NUMBER_WARNING, canConfirm, itemIssues, orderReady } from "../lib/bbip/care/lint";
import type { CareItem } from "../lib/bbip/care/types";

const rx = (fields: Record<string, string>, over: Partial<CareItem> = {}): CareItem => ({
  id: "r",
  kind: "rx",
  fields: { drug: "", brand: "", form: "", dose: "", frequency: "", duration: "", purpose: "", ...fields },
  patientText: "",
  source: "doctor",
  confirmed: false,
  ...over,
});
const full = { drug: "mupirocin", form: "2% 연고", dose: "얇게 도포", frequency: "1일 3회", duration: "5일" };
const texts = (item: CareItem, context = "") => itemIssues(item, context).map((issue) => issue.text);

describe("interactions", () => {
  it("builds the case text from chips and flags", () => {
    expect(
      caseText(
        { patient: ["30대 여성"], conditions: ["임신 12주"], meds: ["와파린"], procedures: ["필러"] },
        [{ level: "caution", text: "항응고 주의", source: "rule" }]
      )
    ).toBe("30대 여성 임신 12주 와파린 필러 항응고 주의");
  });

  it.each([
    ["임신 12주", "doxycycline", "pregnancy-tetracycline"],
    ["수유 중", "트레티노인 크림", "pregnancy-retinoid"],
    ["아스피린", "이부프로펜", "anticoagulant-nsaid"],
    ["와파린", "metronidazole", "warfarin-antimicrobial"],
    ["로아큐탄 복용", "미노사이클린", "isotretinoin-tetracycline"],
    ["페니실린 알레르기", "amoxicillin", "penicillin-allergy"],
    ["페니실린 알레르기", "cefadroxil", "penicillin-allergy-cephalosporin"],
  ])("%s + %s → %s", (context, drug, id) => {
    expect(interactionsFor(rx({ drug }), context).map((rule) => rule.id)).toContain(id);
  });

  it("ignores unrelated drugs, non-drug rows and unrelated cases; reads contingency actions", () => {
    expect(interactionsFor(rx({ drug: "acetaminophen" }), "아스피린 와파린 임신")).toEqual([]);
    expect(interactionsFor(rx({ drug: "doxycycline" }), "40대 남성")).toEqual([]);
    const dressing: CareItem = {
      ...rx({}),
      kind: "dressing",
      fields: { material: "doxycycline", method: "", interval: "", duration: "" },
    };
    expect(interactionsFor(dressing, "임신")).toEqual([]);
    const contingency: CareItem = {
      ...rx({}),
      kind: "contingency",
      fields: { situation: "통증", signs: "", action: "이부프로펜 복용", resolution: "", urgency: "watch" },
    };
    expect(interactionsFor(contingency, "아스피린").map((rule) => rule.id)).toEqual(["anticoagulant-nsaid"]);
    expect(INTERACTION_RULES.every((rule) => rule.text.length > 0)).toBe(true);
  });
});

describe("lint", () => {
  it("errors on missing required fields and blocks confirmation", () => {
    expect(itemIssues(rx({ drug: "mupirocin" }), "").filter((i) => i.level === "error").map((i) => i.text)).toEqual([
      '"제형·함량" 칸을 채우세요',
      '"1회량" 칸을 채우세요',
      '"횟수" 칸을 채우세요',
      '"기간" 칸을 채우세요',
    ]);
    expect(canConfirm(rx({ drug: "mupirocin" }), "")).toBe(false);
    expect(canConfirm(rx(full), "")).toBe(true);
  });

  it("validates urgency and the follow-up day", () => {
    const contingency: CareItem = {
      id: "c",
      kind: "contingency",
      fields: { situation: "HSV", signs: "", action: "항바이러스제", resolution: "", urgency: "soon" },
      patientText: "",
      source: "doctor",
      confirmed: false,
    };
    expect(texts(contingency)).toContain("긴급도는 바로 연락·내원 / 다음 내원 때 / 지켜봐도 됨 중 하나여야 합니다");
    const followup: CareItem = {
      id: "f",
      kind: "followup",
      fields: { day: "7일", when: "D+7", checks: "홍반", next: "" },
      patientText: "",
      source: "doctor",
      confirmed: false,
    };
    expect(canConfirm(followup, "")).toBe(false);
    expect(canConfirm({ ...followup, fields: { ...followup.fields, day: "7" } }, "")).toBe(true);
  });

  it("warns on AI numbers until confirmed, unitless oral doses, numbers for patients and interactions", () => {
    const ai = rx({ ...full, drug: "valacyclovir", form: "정", dose: "1정" }, { source: "ai" });
    expect(texts(ai)).toContain(AI_NUMBER_WARNING);
    expect(texts({ ...ai, confirmed: true })).not.toContain(AI_NUMBER_WARNING);
    expect(texts(rx({ ...full, form: "정", dose: "한 알" }))).toContain(
      "경구약 — 함량이나 1회량에 숫자와 단위를 적으세요"
    );
    expect(texts(rx(full, { patientText: "하루 3번 바르세요" }))).toContain(
      "환자 문장에 숫자가 있습니다 — 처방 칸과 다를 수 있습니다"
    );
    expect(texts(rx({ ...full, drug: "ibuprofen" }), "아스피린")).toContain(
      "주의 — 항응고·항혈소판제 복용 — NSAID는 출혈 위험 ↑ (아세트아미노펜 고려)"
    );
    expect(texts(rx({ ...full, drug: "doxycycline" }), "임신")).toContain("금기 — 임신·수유 중 테트라사이클린계 금기");
    // Interaction matches warn; the doctor decides.
    expect(canConfirm(rx({ ...full, drug: "doxycycline" }), "임신")).toBe(true);
  });

  it("is ready only when every active row is confirmed and valid", () => {
    const ok = rx(full, { confirmed: true });
    expect(orderReady([], "")).toBe(false);
    expect(orderReady([ok], "")).toBe(true);
    expect(orderReady([ok, rx(full)], "")).toBe(false);
    expect(orderReady([ok, rx(full, { removed: { reason: "임신" } })], "")).toBe(true);
    expect(orderReady([rx({ drug: "x" }, { confirmed: true })], "")).toBe(false);
  });
});
