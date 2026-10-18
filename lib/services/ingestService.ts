import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db, sqliteClient } from "../db/client";
import { figures, ingestJobs } from "../db/schema";
import { processDocument } from "../ai/classify";
import { extractText } from "../ingest/extract";
import {
  FIGURES_DIR,
  extractPdfFigures,
  extractEmbeddedMedia,
  listJobFigures,
  type FigureRecord,
} from "../ingest/figures";
import type { SuggestedEntry } from "../ai/schemas";
import { MODEL } from "../ai/client";
import { INGEST_PROMPT_VERSION } from "../ai/prompts";

export interface CreateIngestJobInput {
  /** Uploaded bytes are persisted before the API returns. */
  file?: { buffer: Buffer; filename: string };
  pastedText?: string;
  sourceCitation: string;
  sourceType: string;
  sourceUrl?: string;
}

export type IngestJobView = typeof ingestJobs.$inferSelect;

const INGEST_PAYLOAD_DIR =
  process.env.CODEX_INGEST_PAYLOAD_DIR ?? "./data/ingest-jobs";
const LEASE_MS = Number(process.env.CODEX_INGEST_LEASE_MS ?? 45_000);
const HEARTBEAT_MS = Math.max(1_000, Math.floor(LEASE_MS / 3));
const MAX_RETRY_DELAY_MS = 10 * 60_000;

let activeWorker: Promise<void> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

class IngestCancelledError extends Error {
  constructor() {
    super("사용자가 작업을 취소했습니다.");
    this.name = "IngestCancelledError";
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function futureIso(ms: number): string {
  return new Date(Date.now() + ms).toISOString();
}

export async function getIngestJob(id: string): Promise<IngestJobView | null> {
  const [row] = await db.select().from(ingestJobs).where(eq(ingestJobs.id, id));
  return row ?? null;
}

async function updateJob(
  id: string,
  patch: Partial<typeof ingestJobs.$inferInsert>
): Promise<void> {
  await db
    .update(ingestJobs)
    .set({ ...patch, updatedAt: nowIso() })
    .where(eq(ingestJobs.id, id));
}

function persistPayload(id: string, input: CreateIngestJobInput): {
  payloadPath: string;
  payloadKind: "file" | "text";
} {
  fs.mkdirSync(INGEST_PAYLOAD_DIR, { recursive: true });
  const payloadKind = input.file ? "file" : "text";
  const payloadPath = path.join(INGEST_PAYLOAD_DIR, `${id}.${payloadKind}`);
  const temporaryPath = `${payloadPath}.${randomUUID()}.tmp`;
  const payload = input.file?.buffer ?? Buffer.from(input.pastedText ?? "", "utf8");
  fs.writeFileSync(temporaryPath, payload, { flag: "wx" });
  fs.renameSync(temporaryPath, payloadPath);
  return { payloadPath, payloadKind };
}

function removePayload(payloadPath: string | null): void {
  if (!payloadPath) return;
  try {
    fs.unlinkSync(payloadPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

/**
 * Persist the job and its source before returning. Work is then claimed via
 * a SQLite lease, so a restart can safely resume it instead of losing an
 * in-memory Promise.
 */
export async function startIngestJob(input: CreateIngestJobInput): Promise<IngestJobView> {
  const id = randomUUID();
  const timestamp = nowIso();
  const persisted = persistPayload(id, input);

  try {
    await db.insert(ingestJobs).values({
      id,
      sourceLabel: input.file?.filename ?? "붙여넣은 텍스트",
      sourceCitation: input.sourceCitation,
      sourceType: input.sourceType,
      sourceUrl: input.sourceUrl ?? null,
      status: "pending",
      payloadPath: persisted.payloadPath,
      payloadKind: persisted.payloadKind,
      nextRunAt: timestamp,
      aiModel: MODEL,
      promptVersion: INGEST_PROMPT_VERSION,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  } catch (error) {
    removePayload(persisted.payloadPath);
    throw error;
  }

  kickIngestWorker();
  const job = await getIngestJob(id);
  if (!job) throw new Error("Failed to load ingest job immediately after creation.");
  return job;
}

interface FigureExtraction {
  figures: FigureRecord[];
  note: string;
}

async function extractFigures(
  jobId: string,
  file: { buffer: Buffer; filename: string },
  onProgress: () => Promise<void>
): Promise<FigureExtraction> {
  const lower = file.filename.toLowerCase();
  const supported =
    lower.endsWith(".pdf") || lower.endsWith(".docx") || lower.endsWith(".pptx");
  if (!supported) {
    return { figures: [], note: "이 형식은 그림 추출을 지원하지 않습니다 (PDF/DOCX/PPTX만)." };
  }
  try {
    let extracted: FigureRecord[] = [];
    if (lower.endsWith(".pdf")) {
      extracted = await extractPdfFigures(file.buffer, jobId, onProgress);
    } else if (lower.endsWith(".docx")) {
      extracted = await extractEmbeddedMedia(file.buffer, jobId, "word/media/");
    } else if (lower.endsWith(".pptx")) {
      extracted = await extractEmbeddedMedia(file.buffer, jobId, "ppt/media/");
    }
    return {
      figures: extracted,
      note:
        extracted.length > 0
          ? `그림·표·그래프 ${extracted.length}개를 원본에서 잘라냈습니다.`
          : "문서에서 잘라낼 그림·표·그래프를 찾지 못했습니다.",
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error("[figures] extraction failed:", reason);
    return { figures: [], note: `그림 추출 중 오류가 발생했습니다: ${reason}` };
  }
}

interface ClaimedJob {
  id: string;
  source_label: string;
  source_citation: string;
  source_type: string;
  source_url: string | null;
  payload_path: string | null;
  payload_kind: string | null;
  attempts: number;
  max_attempts: number;
  worker_id: string;
}

/** Atomically claim one runnable or expired job across all local processes. */
function claimNextJob(): ClaimedJob | null {
  const workerId = randomUUID();
  const timestamp = nowIso();
  const leaseUntil = futureIso(LEASE_MS);

  return sqliteClient
    .transaction(() => {
      const row = sqliteClient
        .prepare(
          `SELECT id
             FROM ingest_jobs
            WHERE cancel_requested_at IS NULL
              AND attempts < max_attempts
              AND (
                (status IN ('pending', 'retrying')
                  AND (next_run_at IS NULL OR next_run_at <= ?))
                OR
                (status IN ('extracting', 'processing')
                  AND (lease_until IS NULL OR lease_until <= ?))
              )
            ORDER BY created_at ASC
            LIMIT 1`
        )
        .get(timestamp, timestamp) as { id: string } | undefined;
      if (!row) return null;

      const changed = sqliteClient
        .prepare(
          `UPDATE ingest_jobs
              SET status = 'extracting',
                  attempts = attempts + 1,
                  worker_id = ?,
                  heartbeat_at = ?,
                  lease_until = ?,
                  next_run_at = NULL,
                  error = NULL,
                  updated_at = ?
            WHERE id = ?
              AND cancel_requested_at IS NULL`
        )
        .run(workerId, timestamp, leaseUntil, timestamp, row.id);
      if (changed.changes !== 1) return null;

      return sqliteClient
        .prepare(
          `SELECT id, source_label, source_citation, source_type, source_url,
                  payload_path, payload_kind, attempts, max_attempts, worker_id
             FROM ingest_jobs WHERE id = ?`
        )
        .get(row.id) as ClaimedJob;
    })
    .immediate();
}

async function heartbeat(job: ClaimedJob): Promise<void> {
  const result = sqliteClient
    .prepare(
      `UPDATE ingest_jobs
          SET heartbeat_at = ?, lease_until = ?, updated_at = ?
        WHERE id = ? AND worker_id = ?
          AND status IN ('extracting', 'processing')`
    )
    .run(nowIso(), futureIso(LEASE_MS), nowIso(), job.id, job.worker_id);
  if (result.changes !== 1) throw new Error("ingest 작업 lease를 잃었습니다.");
  await assertNotCancelled(job.id);
}

async function assertNotCancelled(id: string): Promise<void> {
  const row = sqliteClient
    .prepare("SELECT cancel_requested_at FROM ingest_jobs WHERE id = ?")
    .get(id) as { cancel_requested_at: string | null } | undefined;
  if (!row || row.cancel_requested_at) throw new IngestCancelledError();
}

async function cleanupAttemptFigures(jobId: string): Promise<void> {
  const rows = await db
    .select({ filename: figures.filename })
    .from(figures)
    .where(eq(figures.jobId, jobId));
  for (const row of rows) {
    try {
      fs.unlinkSync(path.join(FIGURES_DIR, path.basename(row.filename)));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        console.warn(`[figures] retry cleanup failed for ${row.filename}:`, error);
      }
    }
  }
  await db.delete(figures).where(eq(figures.jobId, jobId));
}

async function loadClaimedInput(job: ClaimedJob): Promise<CreateIngestJobInput> {
  if (!job.payload_path || !job.payload_kind || !fs.existsSync(job.payload_path)) {
    throw new Error("재시도에 필요한 원본 payload를 찾을 수 없습니다.");
  }
  const payload = fs.readFileSync(job.payload_path);
  return {
    file:
      job.payload_kind === "file"
        ? { buffer: payload, filename: job.source_label }
        : undefined,
    pastedText: job.payload_kind === "text" ? payload.toString("utf8") : undefined,
    sourceCitation: job.source_citation,
    sourceType: job.source_type,
    sourceUrl: job.source_url ?? undefined,
  };
}

async function runClaimedJob(job: ClaimedJob): Promise<void> {
  const heartbeatTimer = setInterval(() => {
    void heartbeat(job).catch(() => {
      // The main path verifies ownership at every stage as well.
    });
  }, HEARTBEAT_MS);
  heartbeatTimer.unref?.();

  try {
    await cleanupAttemptFigures(job.id);
    const input = await loadClaimedInput(job);
    await heartbeat(job);

    let text: string;
    let formatNote: string;
    let sourceLabel: string;
    let jobFigures: FigureRecord[] = [];

    if (input.file) {
      const extracted = await extractText(input.file.buffer, input.file.filename);
      text = extracted.text;
      formatNote = extracted.formatNote;
      sourceLabel = input.file.filename;
      const figureResult = await extractFigures(job.id, input.file, async () => heartbeat(job));
      jobFigures = figureResult.figures;
      await updateJob(job.id, { figureNote: figureResult.note });
    } else {
      text = input.pastedText ?? "";
      formatNote = "직접 입력";
      sourceLabel = "붙여넣은 텍스트";
    }

    if (!text.trim()) throw new Error("문서에서 텍스트를 추출하지 못했습니다.");
    await assertNotCancelled(job.id);
    await updateJob(job.id, { status: "processing" });
    await heartbeat(job);

    const result = await processDocument(
      {
        text,
        sourceLabel,
        sourceCitation: input.sourceCitation,
        formatNote,
        figures: jobFigures,
      },
      {
        onProgress: async (processed, total) => {
          await heartbeat(job);
          await updateJob(job.id, { processedChunks: processed, totalChunks: total });
        },
      }
    );

    await assertNotCancelled(job.id);
    await updateJob(job.id, {
      status: "completed",
      totalChunks: result.chunkCount,
      processedChunks: result.chunkCount,
      suggestions: result.suggestions satisfies SuggestedEntry[],
      workerId: null,
      heartbeatAt: null,
      leaseUntil: null,
      payloadPath: null,
    });
    removePayload(job.payload_path);
  } finally {
    clearInterval(heartbeatTimer);
  }
}

function retryDelayMs(attempts: number): number {
  return Math.min(30_000 * 2 ** Math.max(0, attempts - 1), MAX_RETRY_DELAY_MS);
}

function scheduleWorker(delayMs: number): void {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = setTimeout(() => {
    retryTimer = null;
    kickIngestWorker();
  }, delayMs);
  retryTimer.unref?.();
}

async function handleJobFailure(job: ClaimedJob, error: unknown): Promise<void> {
  const cancelled = error instanceof IngestCancelledError;
  const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
  if (cancelled) {
    await updateJob(job.id, {
      status: "cancelled",
      error: message,
      workerId: null,
      heartbeatAt: null,
      leaseUntil: null,
    });
    return;
  }

  if (job.attempts < job.max_attempts) {
    const delay = retryDelayMs(job.attempts);
    await updateJob(job.id, {
      status: "retrying",
      error: message,
      nextRunAt: futureIso(delay),
      workerId: null,
      heartbeatAt: null,
      leaseUntil: null,
    });
    scheduleWorker(delay);
  } else {
    await updateJob(job.id, {
      status: "failed",
      error: message,
      workerId: null,
      heartbeatAt: null,
      leaseUntil: null,
    });
  }
}

async function workerLoop(): Promise<void> {
  while (true) {
    const job = claimNextJob();
    if (!job) return;
    try {
      await runClaimedJob(job);
    } catch (error) {
      await handleJobFailure(job, error);
    }
  }
}

/** Idempotent worker wake-up, called on startup and every ingest poll. */
export function kickIngestWorker(): void {
  if (activeWorker) return;
  activeWorker = workerLoop().finally(() => {
    activeWorker = null;
  });
}

export async function cancelIngestJob(id: string): Promise<IngestJobView | null> {
  const timestamp = nowIso();
  sqliteClient
    .prepare(
      `UPDATE ingest_jobs
          SET cancel_requested_at = ?,
              status = CASE
                WHEN status IN ('pending', 'retrying') THEN 'cancelled'
                ELSE status
              END,
              updated_at = ?
        WHERE id = ? AND status NOT IN ('completed', 'failed', 'cancelled')`
    )
    .run(timestamp, timestamp, id);
  return getIngestJob(id);
}

export async function retryIngestJob(id: string): Promise<IngestJobView | null> {
  const timestamp = nowIso();
  sqliteClient
    .prepare(
      `UPDATE ingest_jobs
          SET status = 'pending', attempts = 0, cancel_requested_at = NULL,
              next_run_at = ?, error = NULL, updated_at = ?
        WHERE id = ? AND status IN ('failed', 'cancelled')
          AND payload_path IS NOT NULL`
    )
    .run(timestamp, timestamp, id);
  kickIngestWorker();
  return getIngestJob(id);
}

export { listJobFigures };
