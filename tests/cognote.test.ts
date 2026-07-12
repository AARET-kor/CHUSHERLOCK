import { describe, expect, it } from "vitest";
import { cognoteFileSchema, COGNOTE_VERSION } from "../lib/share/cognote";

function validFile() {
  return {
    format: "cognote",
    schemaVersion: COGNOTE_VERSION,
    app: "Cognitio",
    exportedAt: new Date().toISOString(),
    notes: [
      {
        title: "보톡스 이마 주입점",
        content: "==yellow:frontalis== 주입 시 ++red:eyebrow ptosis++ 주의\n\n![그림](/api/figures/abc-123)",
        categoryKey: "botox-forehead",
        tier: "procedure_tip",
        tags: ["botox"],
        sources: [{ type: "personal_note", citation: "시술 노트 2026" }],
        figures: [
          {
            oldId: "abc-123",
            kind: "figure",
            caption: "주입점 다이어그램",
            page: 3,
            ext: ".png",
            dataBase64: Buffer.from("fake-image-bytes").toString("base64"),
          },
        ],
      },
    ],
  };
}

describe("cognoteFileSchema", () => {
  it("accepts a well-formed v1 file", () => {
    const result = cognoteFileSchema.safeParse(validFile());
    expect(result.success).toBe(true);
  });

  it("rejects other format markers and versions", () => {
    expect(cognoteFileSchema.safeParse({ ...validFile(), format: "notes" }).success).toBe(false);
    expect(cognoteFileSchema.safeParse({ ...validFile(), schemaVersion: 2 }).success).toBe(false);
  });

  it("rejects figure extensions outside the image whitelist", () => {
    const file = validFile();
    file.notes[0]!.figures[0]!.ext = ".exe" as never;
    expect(cognoteFileSchema.safeParse(file).success).toBe(false);
  });

  it("rejects an empty notes list", () => {
    expect(cognoteFileSchema.safeParse({ ...validFile(), notes: [] }).success).toBe(false);
  });

  it("defaults tags/sources/figures so minimal notes import cleanly", () => {
    const file = validFile();
    const minimal = {
      title: "미니멀 노트",
      content: "내용만 있는 노트",
      categoryKey: "unknown-category",
      tier: "deep_study",
    };
    file.notes = [minimal as never];
    const result = cognoteFileSchema.safeParse(file);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.notes[0]!.figures).toEqual([]);
      expect(result.data.notes[0]!.sources).toEqual([]);
    }
  });
});
