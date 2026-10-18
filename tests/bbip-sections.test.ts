// tests/bbip-sections.test.ts
import { describe, expect, it } from "vitest";
import { SECTIONS, getSection, turnTitle } from "../lib/bbip/sections";

describe("BBIP sections", () => {
  it("defines nine unique sections with instructions", () => {
    expect(SECTIONS).toHaveLength(9);
    expect(new Set(SECTIONS.map((s) => s.key)).size).toBe(9);
    for (const section of SECTIONS) {
      expect(section.instruction.length).toBeGreaterThan(20);
      expect(["safety", "practice", "business"]).toContain(section.group);
    }
  });

  it("routes safety sections to opus and the rest to sonnet", () => {
    expect(getSection("cautions").tier).toBe("opus");
    expect(getSection("adverse").tier).toBe("opus");
    expect(getSection("ddx").tier).toBe("opus");
    expect(getSection("marketing").tier).toBe("sonnet");
    expect(getSection("homecare").promoteTier).toBe("chairside_talk");
  });

  it("titles turns by kind", () => {
    expect(turnTitle({ kind: "brief" })).toBe("⚡ 핵심 브리핑");
    expect(turnTitle({ kind: "section", sectionKey: "ddx" })).toBe("🔍 감별질환");
    expect(turnTitle({ kind: "custom", question: "아스피린 끊어야 해?" })).toBe("💬 아스피린 끊어야 해?");
    expect(turnTitle({ kind: "followup", question: "재발 멘트" })).toBe("💬 재발 멘트");
  });
});
