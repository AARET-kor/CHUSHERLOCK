// lib/records/http.ts
import type { ZodError } from "zod";
import { ChartNoTakenError, RecordValidationError } from "../services/recordsService";
import { PhotoError } from "./photos";

export const badRequest = (error: ZodError) =>
  Response.json({ error: error.issues[0]?.message ?? "입력값을 확인해 주세요." }, { status: 400 });

export const notFound = (what = "기록") => Response.json({ error: `${what}을 찾을 수 없습니다.` }, { status: 404 });

/** Known records errors → 4xx; anything else is rethrown (500). */
export function recordsError(error: unknown): Response {
  if (error instanceof ChartNoTakenError) {
    return Response.json({ error: error.message, patientId: error.patientId }, { status: 409 });
  }
  if (error instanceof RecordValidationError || error instanceof PhotoError) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  throw error;
}
