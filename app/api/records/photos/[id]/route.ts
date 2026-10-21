// app/api/records/photos/[id]/route.ts
import fs from "node:fs";
import { photoPath } from "../../../../../lib/records/files";
import { badRequest, notFound } from "../../../../../lib/records/http";
import { photoPatchSchema } from "../../../../../lib/records/schemas";
import { deletePhoto, getPhoto, setPhotoAngle } from "../../../../../lib/services/recordsService";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** GET ?size=thumb → image/jpeg. Private cache only: these are patient photos. */
export async function GET(request: Request, { params }: Ctx) {
  const photo = getPhoto((await params).id);
  if (!photo) return notFound("사진");
  const thumb = new URL(request.url).searchParams.get("size") === "thumb";
  const filePath = photoPath(thumb ? photo.thumb : photo.file);
  if (!fs.existsSync(filePath)) return notFound("사진 파일");
  return new Response(new Uint8Array(fs.readFileSync(filePath)), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=31536000, immutable" },
  });
}

export async function PATCH(request: Request, { params }: Ctx) {
  const parsed = photoPatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error);
  const photo = setPhotoAngle((await params).id, parsed.data.angle);
  return photo ? Response.json({ photo }) : notFound("사진");
}

export async function DELETE(_request: Request, { params }: Ctx) {
  return deletePhoto((await params).id) ? Response.json({ ok: true }) : notFound("사진");
}
