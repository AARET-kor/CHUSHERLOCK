import { describe, expect, it } from "vitest";
import { createEntrySchema } from "../lib/schemas/entrySchemas";

const validInput = {
  title: "안와상동맥 위험 구역",
  content: "필러 시술 시 supraorbital artery 손상을 피하려면...",
  categoryKey: "supratrochlear-supraorbital-artery",
  tier: "base_medical_knowledge" as const,
  tags: ["anatomy", "filler-safety"],
  sources: [{ type: "textbook" as const, citation: "Facial Anatomy for Injectors, 2024" }],
  relatedEntryIds: [],
  status: "draft" as const,
};

describe("createEntrySchema", () => {
  it("accepts a well-formed entry", () => {
    expect(createEntrySchema.safeParse(validInput).success).toBe(true);
  });

  it("rejects an entry with no sources", () => {
    const result = createEntrySchema.safeParse({ ...validInput, sources: [] });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown tier", () => {
    const result = createEntrySchema.safeParse({ ...validInput, tier: "quick_hack" });
    expect(result.success).toBe(false);
  });

  it("rejects a too-short title", () => {
    const result = createEntrySchema.safeParse({ ...validInput, title: "a" });
    expect(result.success).toBe(false);
  });
});
