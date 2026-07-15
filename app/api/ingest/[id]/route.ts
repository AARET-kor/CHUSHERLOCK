import { NextResponse } from "next/server";
import { getIngestJob, listJobFigures } from "../../../../lib/services/ingestService";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
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
    },
  });
}
