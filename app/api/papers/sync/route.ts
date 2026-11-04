// app/api/papers/sync/route.ts
import { z } from "zod";
import { badRequest, paperError } from "../../../../lib/papers/http";
import { startSync } from "../../../../lib/papers/run";
import { latestRun } from "../../../../lib/services/paperService";

export const dynamic = "force-dynamic";

const syncSchema = z.object({ kind: z.enum(["weekly", "manual"]) });

/** POST { kind } → 202 { run }. Runs in the background; poll GET for the end.
 * Called by the Sync button ("manual") and the LaunchAgent ("weekly"). */
export async function POST(request: Request) {
  const parsed = syncSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error);
  try {
    const { run, done } = startSync(parsed.data.kind);
    void done;
    return Response.json({ run }, { status: 202 });
  } catch (error) {
    return paperError(error);
  }
}

/** GET → { run } (latest sync, finished or not). */
export async function GET() {
  return Response.json({ run: latestRun() });
}
