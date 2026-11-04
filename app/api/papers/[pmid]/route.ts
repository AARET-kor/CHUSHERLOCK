// app/api/papers/[pmid]/route.ts
import { z } from "zod";
import { badRequest } from "../../../../lib/papers/http";
import { getPaper, setReview } from "../../../../lib/services/paperService";

export const dynamic = "force-dynamic";

const reviewSchema = z.object({ reviewStatus: z.enum(["unreviewed", "reviewed", "excluded"]) });

/** PATCH { reviewStatus } → { paper }. Excluded papers leave consult briefs. */
export async function PATCH(request: Request, { params }: { params: Promise<{ pmid: string }> }) {
  const { pmid } = await params;
  const parsed = reviewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error);
  if (!setReview(pmid, parsed.data.reviewStatus, new Date().toISOString())) {
    return Response.json({ error: "논문을 찾을 수 없습니다." }, { status: 404 });
  }
  return Response.json({ paper: getPaper(pmid) });
}
