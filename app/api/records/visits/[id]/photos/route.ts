// app/api/records/visits/[id]/photos/route.ts
import { notFound } from "../../../../../../lib/records/http";
import { guessAngles, PhotoError, processPhoto } from "../../../../../../lib/records/photos";
import { addPhoto, getCourse, getPatientRecord, getVisit } from "../../../../../../lib/services/recordsService";
import type { Angle, Photo } from "../../../../../../lib/records/types";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** POST multipart files[] → { photos, errors }. Each file is processed on
 * its own: one bad file does not stop the rest. Angles are guessed from the
 * course's previous visit and this visit's existing photos. */
export async function POST(request: Request, { params }: Ctx) {
  const visit = getVisit((await params).id);
  if (!visit) return notFound("방문");
  const course = getCourse(visit.courseId)!;
  const record = getPatientRecord(course.patientId)!;
  const visits = record.courses.find((c) => c.id === course.id)!.visits;
  const index = visits.findIndex((v) => v.id === visit.id);
  const previousOrder: Angle[] = (visits.slice(0, index).reverse().find((v) => v.photos.length)?.photos ?? []).map((p) => p.angle);
  const taken: Angle[] = visits[index]!.photos.map((p) => p.angle);

  const form = await request.formData().catch(() => null);
  const files = (form?.getAll("files") ?? []).filter((f): f is File => f instanceof File);
  const angles = guessAngles(files.length, previousOrder, taken);
  const photos: Photo[] = [];
  const errors: Array<{ name: string; message: string }> = [];
  for (const [i, file] of files.entries()) {
    try {
      const processed = await processPhoto(Buffer.from(await file.arrayBuffer()), file.name, file.type);
      photos.push(addPhoto({ visitId: visit.id, angle: angles[i]!, ...processed }));
    } catch (error) {
      errors.push({ name: file.name, message: error instanceof PhotoError ? error.message : "사진을 저장하지 못했습니다." });
    }
  }
  return Response.json({ photos, errors }, { status: photos.length ? 201 : 400 });
}
