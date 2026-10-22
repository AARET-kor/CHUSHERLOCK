// lib/records/schemas.ts
import { z } from "zod";
import { VISIT_NOTE_MAX } from "./types";
import { normalizeChartNo } from "./chart";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "날짜 형식은 YYYY-MM-DD입니다.");
const gais = z.number().int().min(1).max(5).nullable();

export const chartNoSchema = z
  .string()
  .transform(normalizeChartNo)
  .pipe(z.string().regex(/^[A-Z0-9-]{1,20}$/, "차트번호는 영문·숫자·-만 쓸 수 있습니다."));

export const patientCreateSchema = z.object({
  chartNo: chartNoSchema,
  alias: z.string().trim().max(60).default(""),
  features: z.string().trim().max(120).default(""),
  memo: z.string().trim().max(1000).default(""),
});

export const patientPatchSchema = patientCreateSchema.partial();

export const courseCreateSchema = z.object({
  patientId: z.string().min(1).max(100),
  procedure: z.string().trim().min(1, "시술명을 입력해 주세요.").max(60),
  indication: z.string().trim().max(60).default(""),
  plannedSessions: z.number().int().min(1).max(200).nullable().default(null),
  scoreKind: z.enum(["none", "mmasi", "wsrs", "vas"]).default("none"),
  startedAt: date.optional(),
});

export const coursePatchSchema = courseCreateSchema
  .omit({ patientId: true })
  .partial()
  .extend({ status: z.enum(["active", "done", "paused"]).optional(), startedAt: date.optional() });

const visitFields = {
  date,
  kind: z.enum(["baseline", "session", "followup"]),
  sessionNo: z.number().int().min(0).max(500).nullable().default(null),
  product: z.string().trim().max(120).default(""),
  params: z.string().trim().max(200).default(""),
  note: z.string().trim().max(VISIT_NOTE_MAX).default(""),
  gaisDoctor: gais.default(null),
  gaisPatient: gais.default(null),
  score: z.number().int().min(0).max(100).nullable().default(null),
  nextFuDate: date.nullable().default(null),
};

export const visitCreateSchema = z.object({ courseId: z.string().min(1).max(100), ...visitFields });
export const visitPatchSchema = z.object(visitFields).partial();

export const photoPatchSchema = z.object({ angle: z.enum(["front", "left45", "right45", "left", "right", "close"]) });

export const sessionPatientSchema = z.union([
  z.object({ patientId: z.string().min(1).max(100) }),
  z.object({ chartNo: chartNoSchema, alias: z.string().trim().max(60).default("") }),
]);

export const recordCreateSchema = z.object({
  courseId: z.string().min(1).max(100).nullable(),
  newCourse: courseCreateSchema.omit({ patientId: true }).nullable(),
  visit: z.object(visitFields),
});
