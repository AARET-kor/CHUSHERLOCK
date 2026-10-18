import { z } from "zod";
import { getLeafCategories } from "../codex/taxonomy";
import { contentTierSchema } from "../schemas/entrySchemas";

const chipList = z.array(z.string().trim().min(1).max(40)).max(8, "칩은 그룹당 최대 8개입니다.");

export const parsedCaseSchema = z
  .object({ patient: chipList, conditions: chipList, meds: chipList, procedures: chipList })
  .refine(
    (c) => c.patient.length + c.conditions.length + c.meds.length + c.procedures.length > 0,
    "칩이 최소 하나는 있어야 합니다."
  );

export const createSessionSchema = z.union([
  z.object({ input: z.string().trim().min(2, "케이스를 입력해 주세요.").max(500) }),
  // baseSessionId: the session whose chips were edited — its flags are kept.
  z.object({ chips: parsedCaseSchema, baseSessionId: z.string().min(1).max(100).optional() }),
]);
export type CreateSessionBody = z.infer<typeof createSessionSchema>;

export const sectionKeySchema = z.enum([
  "cautions",
  "adverse",
  "ddx",
  "tips",
  "schedule",
  "homecare",
  "marketing",
  "alternatives",
  "notes",
]);

export const turnRequestSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("brief") }),
  z.object({ kind: z.literal("section"), sectionKey: sectionKeySchema }),
  z.object({ kind: z.literal("followup"), question: z.string().trim().min(2).max(200) }),
  z.object({ kind: z.literal("custom"), question: z.string().trim().min(2).max(500) }),
]);

const LEAF_KEYS = new Set(getLeafCategories().map((c) => c.key));

export const promoteSchema = z.object({
  title: z.string().trim().min(2, "제목은 2자 이상이어야 합니다.").max(200),
  categoryKey: z.string().refine((key) => LEAF_KEYS.has(key), "카테고리를 선택해 주세요."),
  tier: contentTierSchema,
  selection: z.string().trim().min(10).max(20000).optional(),
});
