import { z } from "zod";
import { contentTierSchema } from "../schemas/entrySchemas";

// What the model must return for each document chunk. Kept deliberately
// close to CreateEntryInput so accepted suggestions flow straight into
// entryService.createEntry.
export const suggestedEntrySchema = z.object({
  title: z.string(),
  categoryKey: z.string(),
  tier: contentTierSchema,
  tags: z.array(z.string()),
  content: z.string(),
  /** Where in the source this came from, e.g. "Chapter 3 – Vascular complications". */
  sourceLocation: z.string(),
  /** IDs of cropped figures/tables/charts from the source that belong with
   * this note. Empty when the document had no visual material. */
  figureIds: z.array(z.string()).default([]),
});

export type SuggestedEntry = z.infer<typeof suggestedEntrySchema>;

export const chunkResultSchema = z.object({
  entries: z.array(suggestedEntrySchema),
  /** Rolling summary of the document so far, fed into the next chunk's
   * prompt so the model keeps the document's overall flow in view. */
  contextSummary: z.string(),
});

export type ChunkResult = z.infer<typeof chunkResultSchema>;

/** JSON Schema equivalent of chunkResultSchema for structured outputs.
 * Hand-written (instead of zodOutputFormat) so the exact wire schema is
 * visible and stays within the structured-outputs feature set. The
 * categoryKey enum is injected from the live taxonomy so the model can only
 * ever return a valid leaf category. */
export function buildChunkResultJsonSchema(leafCategoryKeys: string[], figureIds: string[] = []) {
  return {
    type: "object",
    properties: {
      entries: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            categoryKey: { type: "string", enum: leafCategoryKeys },
            tier: {
              type: "string",
              enum: ["procedure_tip", "chairside_talk", "deep_study", "base_medical_knowledge"],
            },
            tags: { type: "array", items: { type: "string" } },
            content: { type: "string" },
            sourceLocation: { type: "string" },
            figureIds:
              figureIds.length > 0
                ? { type: "array", items: { type: "string", enum: figureIds } }
                : { type: "array", items: { type: "string" } },
          },
          required: [
            "title",
            "categoryKey",
            "tier",
            "tags",
            "content",
            "sourceLocation",
            "figureIds",
          ],
          additionalProperties: false,
        },
      },
      contextSummary: { type: "string" },
    },
    required: ["entries", "contextSummary"],
    additionalProperties: false,
  };
}
