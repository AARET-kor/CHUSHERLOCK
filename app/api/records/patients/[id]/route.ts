// app/api/records/patients/[id]/route.ts
import { badRequest, notFound, recordsError } from "../../../../../lib/records/http";
import { patientPatchSchema } from "../../../../../lib/records/schemas";
import { deletePatient, getPatientRecord, updatePatient } from "../../../../../lib/services/recordsService";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** GET → PatientRecord */
export async function GET(_request: Request, { params }: Ctx) {
  const record = getPatientRecord((await params).id);
  return record ? Response.json(record) : notFound("환자");
}

export async function PATCH(request: Request, { params }: Ctx) {
  const parsed = patientPatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error);
  try {
    const patient = updatePatient((await params).id, parsed.data);
    return patient ? Response.json({ patient }) : notFound("환자");
  } catch (error) {
    return recordsError(error);
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  return deletePatient((await params).id) ? Response.json({ ok: true }) : notFound("환자");
}
