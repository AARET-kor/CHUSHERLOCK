import { NextResponse } from "next/server";
import {
  cancelIngestJob,
  getIngestJob,
  kickIngestWorker,
  listJobFigures,
  retryIngestJob,
} from "../../../../lib/services/ingestService";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  kickIngestWorker();
  const { id } = await params;
  const job = await getIngestJob(id);
  if (!job) return NextResponse.json({ error: "not found" }, { status: 404 });

  const jobFigures = await listJobFigures(id);

  return NextResponse.json({
    job: {
      figures: jobFigures,
      id: job.id,
      sourceLabel: job.sourceLabel,
      sourceCitation: job.sourceCitation,
      sourceType: job.sourceType,
      sourceUrl: job.sourceUrl,
      status: job.status,
      totalChunks: job.totalChunks,
      processedChunks: job.processedChunks,
      suggestions: job.suggestions ?? null,
      error: job.error,
      figureNote: job.figureNote ?? null,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      heartbeatAt: job.heartbeatAt,
      nextRunAt: job.nextRunAt,
      cancelRequestedAt: job.cancelRequestedAt,
      aiModel: job.aiModel,
      promptVersion: job.promptVersion,
    },
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const job = await cancelIngestJob(id);
  if (!job) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ job });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { action?: string };
  if (body.action !== "retry") {
    return NextResponse.json({ error: "unsupported action" }, { status: 400 });
  }
  const job = await retryIngestJob(id);
  if (!job) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ job });
}
