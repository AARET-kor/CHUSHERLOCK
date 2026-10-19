// tests/bbip-anatomy-tokens.test.ts
import { describe, expect, it } from "vitest";
import { atlasTokenIds, atlasTokensToText } from "../lib/bbip/anatomy/tokens";
import { buildAtlasBlock } from "../lib/bbip/anatomy/prompt";
import { anatomyPlanFor } from "../lib/bbip/anatomy/regions";
import { renderEvidenceHtml, toPlainNoteText } from "../lib/bbip/evidence";
import { fakeTurnText } from "../lib/bbip/generate";

describe("atlas tokens", () => {
  it("renders known ids as focusable chips", () => {
    const html = renderEvidenceHtml("{{atlas:angular-artery}} 주의 [AI]", []);
    expect(html).toContain('<button type="button" class="atlas-ref" data-atlas="angular-artery"');
    expect(html).toContain(">각동맥</button>");
  });

  it("drops unknown ids to plain text", () => {
    const html = renderEvidenceHtml("{{atlas:made-up-artery}} 근처", []);
    expect(html).not.toContain("atlas-ref");
    expect(html).toContain("made-up-artery");
    expect(html).not.toContain("{{");
  });

  it("leaves tokens inside code untouched", () => {
    expect(renderEvidenceHtml("`{{atlas:angular-artery}}`", [])).not.toContain("atlas-ref");
  });

  it("lists known ids and spells tokens out for notes", () => {
    expect(atlasTokenIds("{{atlas:facial-artery}} {{atlas:nope}} {{atlas:facial-artery}}")).toEqual(["facial-artery"]);
    expect(atlasTokensToText("{{atlas:facial-artery}} 주행")).toBe("안면동맥(facial a.) 주행");
    expect(toPlainNoteText("{{atlas:facial-artery}} 주의 [AI]")).toBe("안면동맥(facial a.) 주의 (AI 보충)");
  });
});

describe("atlas prompt block", () => {
  it("is empty without a plan", () => {
    expect(buildAtlasBlock(null)).toBe("");
  });

  it("lists region structures by id, name, depth and risk only", () => {
    const block = buildAtlasBlock(anatomyPlanFor({ patient: [], conditions: ["팔자"], meds: [], procedures: ["필러"] }));
    expect(block.startsWith("<atlas>")).toBe(true);
    expect(block).toContain("facial-artery");
    expect(block).toContain("{{atlas:id}}");
    expect(block).not.toMatch(/\(\d+,\d+\)/);
  });
});

describe("fake brief", () => {
  it("mentions an atlas structure when the case maps to the atlas", () => {
    const text = fakeTurnText({
      session: {
        id: "s", chips: { patient: [], conditions: [], meds: [], procedures: ["팔자 필러"] },
        flags: [], sourceNoteIds: [], promptVersion: "bbip-v1", createdAt: "",
      },
      entries: [], priorTurns: [], request: { kind: "brief" },
    });
    expect(text).toMatch(/\{\{atlas:[a-z-]+\}\}/);
  });
});
