// tests/records-link.test.ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ParsedCase } from "../lib/bbip/types";
import { setupTempDb } from "./helpers/tempDb";

let env: Awaited<ReturnType<typeof setupTempDb>>;
let open: typeof import("../lib/bbip/openSession");
let records: typeof import("../lib/services/recordsService");

beforeAll(async () => {
  env = await setupTempDb("records-link");
  open = await import("../lib/bbip/openSession");
  records = await import("../lib/services/recordsService");
  const p = records.createPatient({ chartNo: "20431", alias: "KJ", features: "40대 여성 · 기미", memo: "" });
  records.createCourse({ patientId: p.id, procedure: "피코토닝", indication: "기미", plannedSessions: 20, scoreKind: "none", startedAt: "2026-09-01" });
});
afterAll(() => env.cleanup());

const chips: ParsedCase = { patient: ["40대 여성"], conditions: ["기미"], meds: [], procedures: ["피코토닝"] };

function deps(seen: string[]) {
  return {
    listEntries: async () => [],
    parse: async (input: string) => {
      seen.push(input);
      return { chips, flags: [], degraded: false };
    },
  };
}

describe("openSession patient link", () => {
  it("links an exact chart number and keeps it out of the parser and chips", async () => {
    const seen: string[] = [];
    const result = await open.openSession({ input: "#20431 40대 여성 기미 피코토닝" }, deps(seen));
    expect(seen).toEqual(["40대 여성 기미 피코토닝"]);
    expect(JSON.stringify(result.session.chips)).not.toContain("20431");
    expect(result.link.patient?.patient.chartNo).toBe("20431");
    expect(result.session.patientId).toBe(result.link.patient?.patient.id);
    expect(result.link.candidates).toEqual([]);
  });

  it("returns an unknown chart number as pending, without linking", async () => {
    const result = await open.openSession({ input: "#99881 40대 여성 기미 피코토닝" }, deps([]));
    expect(result.link).toMatchObject({ patient: null, pendingChartNo: "99881" });
    expect(result.session.patientId).toBeUndefined();
  });

  it("suggests similar patients when there is no chart number", async () => {
    const result = await open.openSession({ input: "40대 여성 기미 피코토닝" }, deps([]));
    expect(result.link.patient).toBeNull();
    expect(result.link.candidates[0]?.patient.chartNo).toBe("20431");
  });

  it("keeps the link when chips are edited", async () => {
    const first = await open.openSession({ input: "#20431 기미 피코토닝" }, deps([]));
    const edited = await open.openSession({ chips, baseSessionId: first.session.id }, deps([]));
    expect(edited.session.patientId).toBe(first.session.patientId);
  });

  it("rejects a memo that is only a chart number", async () => {
    await expect(open.openSession({ input: "#20431" }, deps([]))).rejects.toThrow(open.EmptyCaseError);
  });

  it("loads the link and the session's visit with the view", async () => {
    const first = await open.openSession({ input: "#20431 기미 피코토닝" }, deps([]));
    const view = await open.loadSessionView(first.session.id);
    expect(view?.link?.patient?.patient.chartNo).toBe("20431");
    // Linked consults are recorded automatically as a visit of this consult.
    expect(view?.visit?.sessionId).toBe(first.session.id);
    expect(first.visit?.id).toBe(view?.visit?.id);
  });
});
