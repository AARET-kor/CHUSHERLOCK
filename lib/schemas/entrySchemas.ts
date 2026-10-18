import { z } from "zod";

export const evidenceLevelSchema = z.enum([
  "unknown",
  "expert_consensus",
  "observational",
  "randomized_trial",
  "systematic_review",
  "guideline",
]);

export const sourceInputSchema = z.object({
  type: z.enum([
    "paper",
    "textbook",
    "book",
    "course",
    "manufacturer_guideline",
    "personal_note",
    "website",
    "other",
  ]),
  citation: z.string().min(1, "출처(citation)를 입력해 주세요."),
  url: z.string().url().optional().or(z.literal("")),
  authors: z.string().optional(),
  year: z.number().int().min(1900).max(2100).optional(),
  versionLabel: z.string().max(120).optional(),
  validUntil: z.string().date().optional().or(z.literal("")),
  evidenceLevel: evidenceLevelSchema.optional(),
});

export const contentTierSchema = z.enum([
  "procedure_tip",
  "chairside_talk",
  "deep_study",
  "base_medical_knowledge",
]);

export const claimInputSchema = z.object({
  claimText: z.string().min(1).max(4000),
  representation: z.enum(["verbatim", "ai_paraphrase", "author_note"]),
  originalQuote: z.string().max(4000).optional(),
  sourceLocation: z.string().min(1).max(500),
  pageStart: z.number().int().positive().nullable().optional(),
  pageEnd: z.number().int().positive().nullable().optional(),
  section: z.string().max(500).optional(),
  sourceIndex: z.number().int().nonnegative().default(0),
  evidenceLevel: evidenceLevelSchema.default("unknown"),
  conflictStatus: z.enum(["none", "possible", "confirmed"]).default("none"),
  conflictNote: z.string().max(2000).optional(),
  conflictsWithClaimId: z.string().optional(),
  verifiedBy: z.string().max(200).optional(),
  verifiedAt: z.string().datetime().optional(),
});

export const createEntrySchema = z.object({
  title: z
    .string()
    .min(2, "제목은 2자 이상이어야 합니다.")
    .max(200, "제목이 너무 깁니다."),
  content: z
    .string()
    .min(10, "내용이 너무 짧습니다. 지나친 요약 없이 이해하기 쉽게 작성해 주세요."),
  categoryKey: z.string().min(1, "카테고리를 선택해 주세요."),
  tier: contentTierSchema,
  tags: z.array(z.string().min(1)).default([]),
  sources: z
    .array(sourceInputSchema)
    .min(1, "최소 하나의 출처를 남겨야 합니다."),
  relatedEntryIds: z.array(z.string()).default([]),
  /** Cropped source figures to attach to this entry. */
  figureIds: z.array(z.string()).default([]),
  claims: z.array(claimInputSchema).max(50).default([]),
  provenance: z
    .object({
      model: z.string().max(200).optional(),
      promptVersion: z.string().max(100).optional(),
    })
    .optional(),
  status: z.enum(["draft", "reviewed"]).default("draft"),
  reviewedBy: z.string().max(200).optional(),
  reviewDueAt: z.string().date().optional().or(z.literal("")),
});

export type CreateEntryInput = z.infer<typeof createEntrySchema>;

export const updateEntrySchema = createEntrySchema.partial().extend({
  id: z.string().min(1),
  changedBy: z.string().max(200).optional(),
  changeNote: z.string().max(500).optional(),
});

export type UpdateEntryInput = z.infer<typeof updateEntrySchema>;
