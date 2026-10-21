// app/api/bbip/sessions/[id]/patient/route.ts
import { featuresFromChips } from "../../../../../../lib/records/features";
import { badRequest, notFound } from "../../../../../../lib/records/http";
import { sessionPatientSchema } from "../../../../../../lib/records/schemas";
import { getSession } from "../../../../../../lib/services/bbipService";
import {
  createPatient,
  getPatient,
  getPatientByChartNo,
  linkSessionPatient,
  patientSummary,
} from "../../../../../../lib/services/recordsService";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** PUT { patientId } | { chartNo, alias? } → { patient: PatientSummary }.
 * A chart number that does not exist yet registers the patient, with
 * features taken from the session's chips. */
export async function PUT(request: Request, { params }: Ctx) {
  const session = getSession((await params).id);
  if (!session) return notFound("세션");
  const parsed = sessionPatientSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error);
  let patientId: string;
  if ("patientId" in parsed.data) {
    if (!getPatient(parsed.data.patientId)) return notFound("환자");
    patientId = parsed.data.patientId;
  } else {
    const existing = getPatientByChartNo(parsed.data.chartNo);
    patientId =
      existing?.id ??
      createPatient({ chartNo: parsed.data.chartNo, alias: parsed.data.alias, features: featuresFromChips(session.chips), memo: "" }).id;
  }
  linkSessionPatient(session.id, patientId);
  return Response.json({ patient: patientSummary(patientId) });
}

/** DELETE → unlink ("이 환자가 아님"). The patient and its records stay. */
export async function DELETE(_request: Request, { params }: Ctx) {
  const id = (await params).id;
  if (!getSession(id)) return notFound("세션");
  linkSessionPatient(id, null);
  return Response.json({ ok: true });
}
