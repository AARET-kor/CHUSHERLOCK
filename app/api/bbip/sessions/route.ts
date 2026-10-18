// app/api/bbip/sessions/route.ts
import { sanitizeInput } from "../../../../lib/bbip/parse";
import { EmptyCaseError, openSession } from "../../../../lib/bbip/openSession";
import { createSessionSchema } from "../../../../lib/bbip/schemas";
import { listSessions } from "../../../../lib/services/bbipService";

const EMPTY_CASE = "케이스를 확인해 주세요.";

export const dynamic = "force-dynamic";

/** POST { input } | { chips } → { session, notes, degraded } */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = createSessionSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요." },
      { status: 400 }
    );
  }
  if ("input" in parsed.data && sanitizeInput(parsed.data.input).trim().length < 2) {
    return Response.json({ error: EMPTY_CASE }, { status: 400 });
  }
  try {
    return Response.json(await openSession(parsed.data));
  } catch (error) {
    if (error instanceof EmptyCaseError) {
      return Response.json({ error: EMPTY_CASE }, { status: 400 });
    }
    throw error;
  }
}

/** GET → { sessions } (newest 30, for the history drawer) */
export async function GET() {
  return Response.json({ sessions: listSessions(30) });
}
