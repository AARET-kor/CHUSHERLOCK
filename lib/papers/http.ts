// lib/papers/http.ts
import type { ZodError } from "zod";
import { AnalysisError } from "./analyze";
import { AlreadyAnalyzedError, PaperNotFoundError, SyncRunningError } from "./run";

export const badRequest = (error: ZodError) =>
  Response.json({ error: error.issues[0]?.message ?? "입력값을 확인해 주세요." }, { status: 400 });

/** Known paper errors → status codes; anything else is rethrown (500). */
export function paperError(error: unknown): Response {
  if (error instanceof PaperNotFoundError) return Response.json({ error: error.message }, { status: 404 });
  if (error instanceof AlreadyAnalyzedError || error instanceof SyncRunningError) {
    return Response.json({ error: error.message }, { status: 409 });
  }
  if (error instanceof AnalysisError) return Response.json({ error: error.message }, { status: 502 });
  throw error;
}
