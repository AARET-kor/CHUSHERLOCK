import { NextRequest, NextResponse } from "next/server";
import { cognoteFileSchema, importCognote } from "../../../../lib/share/cognote";

/** POST /api/share/import — accept a .cognote file (multipart "file" field
 * or raw JSON body) and recreate its notes, figures included, locally. */
export async function POST(request: NextRequest) {
  let raw: string;
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: ".cognote 파일을 첨부해 주세요." }, { status: 400 });
    }
    raw = await file.text();
  } else {
    raw = await request.text();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "올바른 .cognote 파일이 아닙니다." }, { status: 400 });
  }

  const result = cognoteFileSchema.safeParse(parsed);
  if (!result.success) {
    return NextResponse.json(
      { error: "지원하지 않는 파일 형식입니다. (.cognote v1만 지원)" },
      { status: 400 }
    );
  }

  const { imported, skipped } = await importCognote(result.data);
  return NextResponse.json({
    imported: imported.length,
    skipped,
    titles: imported.map((e) => e.title),
    entryIds: imported.map((e) => e.id),
  });
}
