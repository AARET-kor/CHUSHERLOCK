// app/patients/[id]/page.tsx
import { notFound } from "next/navigation";
import { PatientPage } from "../../../components/records/PatientPage";
import { getPatientRecord } from "../../../lib/services/recordsService";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const record = getPatientRecord((await params).id);
  if (!record) notFound();
  return <PatientPage initial={record} />;
}
