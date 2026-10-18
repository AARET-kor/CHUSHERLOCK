// app/api/bbip/sessions/[id]/turns/route.ts
import { ndjsonStream } from "../../../../../../lib/bbip/ndjson";
import { sanitizeInput } from "../../../../../../lib/bbip/parse";
import { runTurn } from "../../../../../../lib/bbip/runTurn";
import { turnRequestSchema } from "../../../../../../lib/bbip/schemas";
import { getSession } from "../../../../../../lib/services/bbipService";

export const dynamic = "force-dynamic";

/** POST TurnRequest → NDJSON StreamEvent lines. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = turnRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "요청을 확인해 주세요." },
      { status: 400 }
    );
  }
  if ("question" in parsed.data && sanitizeInput(parsed.data.question).trim().length < 2) {
    return Response.json({ error: "질문을 확인해 주세요." }, { status: 400 });
  }
  if (!getSession(id)) {
    return Response.json({ error: "세션을 찾을 수 없습니다." }, { status: 404 });
  }
  return new Response(ndjsonStream(runTurn(id, parsed.data)), {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
