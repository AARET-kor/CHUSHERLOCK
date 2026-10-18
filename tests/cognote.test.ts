import { describe, expect, it } from "vitest";
import {
  assertCognoteResources,
  cognoteFileSchema,
  COGNOTE_MAX_NOTES,
  COGNOTE_VERSION,
  decodeCognoteFigure,
} from "../lib/share/cognote";

const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

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
            dataBase64: PNG_HEADER.toString("base64"),
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
      expect(result.data.notes[0]!.claims).toEqual([]);
    }
  });

  it("rejects a MIME/extension mismatch after decoding", () => {
    const result = cognoteFileSchema.parse(validFile());
    result.notes[0]!.figures[0]!.ext = ".jpg";
    expect(() => decodeCognoteFigure(result.notes[0]!.figures[0]!)).toThrow(
      "확장자가 일치하지 않습니다"
    );
  });

  it("caps the total note count", () => {
    const file = validFile();
    file.notes = Array.from({ length: COGNOTE_MAX_NOTES + 1 }, (_, index) => ({
      ...file.notes[0]!,
      title: `note ${index}`,
      figures: [],
    }));
    expect(cognoteFileSchema.safeParse(file).success).toBe(false);
  });

  it("accepts valid image signatures and disk resource checks", () => {
    const result = cognoteFileSchema.parse(validFile());
    expect(() => assertCognoteResources(result)).not.toThrow();
  });
});
