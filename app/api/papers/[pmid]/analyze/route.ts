// app/api/papers/[pmid]/analyze/route.ts
import { paperError } from "../../../../../lib/papers/http";
import { analyzeOne } from "../../../../../lib/papers/run";
import { getPaper } from "../../../../../lib/services/paperService";

export const dynamic = "force-dynamic";

/** POST → { paper }. The doctor's own request: outside the weekly 5, and 409
 * for a paper that was already analyzed. */
export async function POST(_request: Request, { params }: { params: Promise<{ pmid: string }> }) {
  const { pmid } = await params;
  try {
    await analyzeOne(pmid);
    return Response.json({ paper: getPaper(pmid) });
  } catch (error) {
    return paperError(error);
  }
}
