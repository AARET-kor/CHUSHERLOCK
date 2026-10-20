// lib/bbip/care/schemas.ts
import { z } from "zod";
import { pickFields } from "./fields";
import type { CareItem } from "./types";

const careItemInput = z.object({
  id: z.string().min(1).max(100),
  kind: z.enum(["rx", "dressing", "contingency", "followup"]),
  fields: z.record(z.string(), z.string().max(500)),
  patientText: z.string().max(500),
  patientTextBasis: z.string().max(4000).optional(),
  source: z.enum(["set", "note", "literature", "ai", "doctor"]),
  cite: z.string().max(10).optional(),
  confirmed: z.boolean(),
  removed: z.object({ reason: z.string().max(300) }).optional(),
});

/** Client rows keep only their kind's own fields. */
export const careItemSchema = careItemInput.transform(
  (item): CareItem => ({ ...item, fields: pickFields(item.kind, item.fields) })
);

export const patchCareSchema = z.object({ items: z.array(careItemSchema).max(60) });

export const saveCareSetSchema = z.object({ procedure: z.string().trim().min(1).max(40) });
