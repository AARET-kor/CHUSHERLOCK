// tests/records-schedule.test.ts
import { describe, expect, it } from "vitest";
import type { CareItem } from "../lib/bbip/care/types";
import { addDays, fuStatus, nextFuFromCare, nextSessionNo, todayIso } from "../lib/records/schedule";

const fu = (day: string, removed = false): CareItem => ({
  id: crypto.randomUUID(),
  kind: "followup",
  fields: { day, when: `D+${day}`, checks: "홍반", next: "" },
  patientText: "",
  source: "doctor",
  confirmed: true,
  ...(removed ? { removed: { reason: "x" } } : {}),
});

describe("schedule", () => {
  it("uses the Seoul calendar day", () => {
    expect(todayIso(new Date("2026-10-20T16:30:00Z"))).toBe("2026-10-21");
    expect(todayIso(new Date("2026-10-20T14:00:00Z"))).toBe("2026-10-20");
  });

  it("adds days across month ends", () => {
    expect(addDays("2026-10-28", 7)).toBe("2026-11-04");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("classifies follow-up dates", () => {
    expect(fuStatus("2026-10-20", "2026-10-21")).toBe("overdue");
    expect(fuStatus("2026-10-21", "2026-10-21")).toBe("today");
    expect(fuStatus("2026-10-28", "2026-10-21")).toBe("week");
    expect(fuStatus("2026-10-29", "2026-10-21")).toBe("later");
  });

  it("numbers the next session from session visits only", () => {
    expect(nextSessionNo([])).toBe(1);
    expect(nextSessionNo([{ kind: "baseline", sessionNo: null }])).toBe(1);
    expect(
      nextSessionNo([
        { kind: "session", sessionNo: 3 },
        { kind: "followup", sessionNo: 9 },
        { kind: "session", sessionNo: 5 },
      ])
    ).toBe(6);
  });

  it("takes the first active numeric F/U day from a care order", () => {
    expect(nextFuFromCare([fu("1", true), fu("x"), fu("7"), fu("14")], "2026-10-21")).toBe("2026-10-28");
    expect(nextFuFromCare([], "2026-10-21")).toBeNull();
  });
});
