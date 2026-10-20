// tests/bbip-care-format.test.ts
import { describe, expect, it } from "vitest";
import { handoutSections, handoutText, orderText, seoulDay, visitDate } from "../lib/bbip/care/format";
import type { CareItem, CareKind } from "../lib/bbip/care/types";

const item = (kind: CareKind, fields: Record<string, string>, over: Partial<CareItem> = {}): CareItem => ({
  id: `${kind}-${Object.values(fields)[0]}`,
  kind,
  fields,
  patientText: "",
  source: "doctor",
  confirmed: true,
  ...over,
});

const items: CareItem[] = [
  item(
    "rx",
    { drug: "mupirocin", brand: "박트로반", form: "2% 연고", dose: "얇게 도포", frequency: "1일 3회", duration: "5일", purpose: "감염 예방" },
    { patientText: "세안 후 시술 부위에 바르세요." }
  ),
  item("rx", { drug: "valacyclovir", brand: "", form: "500 mg 정", dose: "1정", frequency: "1일 2회", duration: "5일", purpose: "" }),
  item(
    "dressing",
    { material: "재생크림", method: "세안 후 얇게", interval: "1일 2회", duration: "7일" },
    { patientText: "문지르지 말고 톡톡 두드려 바르세요." }
  ),
  item(
    "contingency",
    { situation: "HSV 재발 의심", signs: "수포·작열감", action: "항바이러스제 시작", resolution: "1~2주 내 호전", urgency: "now" },
    { patientText: "물집이나 화끈거림이 생기면" }
  ),
  item(
    "contingency",
    { situation: "멍", signs: "", action: "냉찜질", resolution: "1~2주 내 소실", urgency: "watch" },
    { patientText: "멍이 들면 냉찜질을 해 주세요." }
  ),
  item("followup", { day: "7", when: "D+7", checks: "홍반·색소 확인", next: "2회차 일정" }, { patientText: "경과를 확인합니다." }),
  item(
    "rx",
    { drug: "doxycycline", brand: "", form: "100 mg 캡슐", dose: "1캡슐", frequency: "1일 2회", duration: "7일", purpose: "" },
    { removed: { reason: "임신" } }
  ),
];

describe("orderText", () => {
  it("lists active rows by kind in EMR order", () => {
    expect(orderText(items)).toBe(
      [
        "[처방]",
        "1. mupirocin (박트로반) 2% 연고 · 얇게 도포 · 1일 3회 · 5일 — 감염 예방",
        "2. valacyclovir 500 mg 정 · 1정 · 1일 2회 · 5일",
        "",
        "[드레싱·처치]",
        "- 재생크림 · 세안 후 얇게 · 1일 2회 · 7일",
        "",
        "[이럴 때는]",
        "- HSV 재발 의심 — 수포·작열감 → 항바이러스제 시작 · 1~2주 내 호전 [바로 연락·내원]",
        "- 멍 → 냉찜질 · 1~2주 내 소실 [지켜봐도 됨]",
        "",
        "[F/U]",
        "- D+7 · 홍반·색소 확인 · 2회차 일정",
      ].join("\n")
    );
  });
});

describe("handout", () => {
  it("computes visit dates on the Seoul calendar", () => {
    const base = seoulDay("2026-10-20T15:30:00.000Z"); // 2026-10-21 00:30 KST
    expect(visitDate(base, 0)).toBe("10월 21일(수)");
    expect(visitDate(base, 7)).toBe("10월 28일(수)");
  });

  it("builds patient sections from the fields and plain sentences", () => {
    const sections = handoutSections(items, seoulDay("2026-10-20T03:00:00.000Z"));
    expect(sections.map((s) => s.title)).toEqual(["드실 약·바르실 약", "상처 관리", "이럴 땐 이렇게 하세요", "다음 내원"]);
    expect(sections[0]!.lines).toEqual([
      "박트로반(2% 연고): 얇게 도포, 1일 3회, 5일. 세안 후 시술 부위에 바르세요.",
      "valacyclovir(500 mg 정): 1정, 1일 2회, 5일.",
    ]);
    expect(sections[1]!.lines).toEqual(["재생크림 — 세안 후 얇게, 1일 2회, 7일. 문지르지 말고 톡톡 두드려 바르세요."]);
    expect(sections[2]!.lines).toEqual([
      "물집이나 화끈거림이 생기면 → 바로 병원으로 연락하세요.",
      "멍이 들면 냉찜질을 해 주세요. → 대부분 저절로 좋아집니다. 지켜보셔도 됩니다.",
    ]);
    expect(sections[3]!.lines).toEqual(["10월 27일(화) — 경과를 확인합니다."]);
  });

  it("drops removed rows and empty sections, and renders plain text", () => {
    expect(handoutSections(items, new Date()).flatMap((s) => s.lines).join(" ")).not.toContain("doxycycline");
    expect(handoutText(handoutSections([items[0]!], seoulDay("2026-10-20T03:00:00.000Z")))).toBe(
      [
        "시술 후 안내",
        "",
        "■ 드실 약·바르실 약",
        "- 박트로반(2% 연고): 얇게 도포, 1일 3회, 5일. 세안 후 시술 부위에 바르세요.",
        "",
        "궁금한 점이나 이상 증상이 있으면 병원으로 연락해 주세요.",
      ].join("\n")
    );
  });
});
