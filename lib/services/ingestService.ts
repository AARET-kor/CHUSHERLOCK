import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { ingestJobs } from "../db/schema";
import { processDocument } from "../ai/classify";
import type { SuggestedEntry } from "../ai/schemas";

export interface CreateIngestJobInput {
  text: string;
  sourceLabel: string;
  sourceCitation: string;
  sourceType: string;
  sourceUrl?: string;
  formatNote: string;
}

export type IngestJobView = typeof ingestJobs.$inferSelect;

function nowIso(): string {
  return new Date().toISOString();
}

export async function getIngestJob(id: string): Promise<IngestJobView | null> {
  const [row] = await db.select().from(ingestJobs).where(eq(ingestJobs.id, id));
  return row ?? null;
}

async function updateJob(id: string, patch: Partial<typeof ingestJobs.$inferInsert>): Promise<void> {
  await db
    .update(ingestJobs)
    .set({ ...patch, updatedAt: nowIso() })
    .where(eq(ingestJobs.id, id));
}

/**
 * Creates the job row and kicks off processing in the background (the API
 * route returns immediately; the UI polls GET /api/ingest/[id]). Large
 * documents run for minutes, so the request/response cycle must not wait.
 */
export async function startIngestJob(input: CreateIngestJobInput): Promise<IngestJobView> {
  const id = randomUUID();
  const timestamp = nowIso();

  await db.insert(ingestJobs).values({
    id,
    sourceLabel: input.sourceLabel,
    sourceCitation: input.sourceCitation,
    sourceType: input.sourceType,
    sourceUrl: input.sourceUrl ?? null,
    status: "pending",
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  void runJob(id, input).catch(async (error) => {
    await updateJob(id, {
      status: "failed",
      error: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.",
    });
  });

  const job = await getIngestJob(id);
  if (!job) throw new Error("Failed to load ingest job immediately after creation.");
  return job;
}

async function runJob(id: string, input: CreateIngestJobInput): Promise<void> {
  await updateJob(id, { status: "processing" });

  const result = await processDocument(
    {
      text: input.text,
      sourceLabel: input.sourceLabel,
      sourceCitation: input.sourceCitation,
      formatNote: input.formatNote,
    },
    {
      onProgress: async (processed, total) => {
        await updateJob(id, { processedChunks: processed, totalChunks: total });
      },
    }
  );

  await updateJob(id, {
    status: "completed",
    totalChunks: result.chunkCount,
    processedChunks: result.chunkCount,
    suggestions: result.suggestions satisfies SuggestedEntry[],
  });
}
