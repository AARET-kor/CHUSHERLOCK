// app/api/bbip/sessions/route.ts
import { openSession } from "../../../../lib/bbip/openSession";
import { createSessionSchema } from "../../../../lib/bbip/schemas";
import { listSessions } from "../../../../lib/services/bbipService";

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
  return Response.json(await openSession(parsed.data));
}

/** GET → { sessions } (newest 30, for the history drawer) */
export async function GET() {
  return Response.json({ sessions: listSessions(30) });
}
