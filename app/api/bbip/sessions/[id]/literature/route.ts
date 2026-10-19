// app/api/bbip/sessions/[id]/literature/route.ts
import { runLiterature } from "../../../../../../lib/bbip/literature/runLiterature";
import { ndjsonStream } from "../../../../../../lib/bbip/ndjson";
import { getSession } from "../../../../../../lib/services/bbipService";

export const dynamic = "force-dynamic";

/** POST → literature search + 문헌 근거 card as NDJSON StreamEvent lines. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!getSession(id)) {
    return Response.json({ error: "세션을 찾을 수 없습니다." }, { status: 404 });
  }
  return new Response(ndjsonStream(runLiterature(id)), {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
