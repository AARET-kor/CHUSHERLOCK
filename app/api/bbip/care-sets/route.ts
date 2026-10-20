// app/api/bbip/care-sets/route.ts
import { listCareSets } from "../../../../lib/services/careService";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ sets: listCareSets() });
}
