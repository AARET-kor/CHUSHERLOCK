// app/patients/[id]/courses/[courseId]/page.tsx
import { notFound } from "next/navigation";
import { CoursePage } from "../../../../../components/records/CoursePage";
import { todayIso } from "../../../../../lib/records/schedule";
import { getPatientRecord } from "../../../../../lib/services/recordsService";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string; courseId: string }> }) {
  const { id, courseId } = await params;
  const record = getPatientRecord(id);
  const course = record?.courses.find((c) => c.id === courseId);
  if (!record || !course) notFound();
  return <CoursePage patient={record.patient} initial={course} today={todayIso()} />;
}
