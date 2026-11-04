// app/api/papers/journals/route.ts
import { z } from "zod";
import { badRequest } from "../../../../lib/papers/http";
import { updateJournal } from "../../../../lib/services/paperService";

export const dynamic = "force-dynamic";

const journalSchema = z.object({
  ta: z.string().min(1).max(200),
  impactFactor: z.number().min(0).max(500).nullable(),
  ifYear: z.number().int().min(1990).max(2100).nullable().optional(),
});

/** PATCH { ta, impactFactor, ifYear? } → { ok }. Sorting picks it up at once. */
export async function PATCH(request: Request) {
  const parsed = journalSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error);
  const { ta, impactFactor, ifYear } = parsed.data;
  if (!updateJournal(ta, { impactFactor, ifYear })) {
    return Response.json({ error: "저널을 찾을 수 없습니다." }, { status: 404 });
  }
  return Response.json({ ok: true });
}
