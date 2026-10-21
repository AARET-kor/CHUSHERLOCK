// app/api/records/patients/route.ts
import { recordsError, badRequest } from "../../../../lib/records/http";
import { patientCreateSchema } from "../../../../lib/records/schemas";
import { createPatient, searchPatients } from "../../../../lib/services/recordsService";

export const dynamic = "force-dynamic";

/** GET ?q= → { patients: PatientSummary[] } */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  return Response.json({ patients: searchPatients(q) });
}

/** POST { chartNo, alias?, features?, memo? } → 201 { patient } | 409 { patientId } */
export async function POST(request: Request) {
  const parsed = patientCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error);
  try {
    return Response.json({ patient: createPatient(parsed.data) }, { status: 201 });
  } catch (error) {
    return recordsError(error);
  }
}
