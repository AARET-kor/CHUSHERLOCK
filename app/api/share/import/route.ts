import { NextRequest, NextResponse } from "next/server";
import {
  COGNOTE_MAX_FILE_BYTES,
  assertCognoteResources,
  cognoteFileSchema,
  importCognote,
} from "../../../../lib/share/cognote";

/** POST /api/share/import — accept a .cognote file (multipart "file" field
 * or raw JSON body) and recreate its notes, figures included, locally. */
export async function POST(request: NextRequest) {
  let raw: string;
  const contentType = request.headers.get("content-type") ?? "";
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > COGNOTE_MAX_FILE_BYTES) {
    return NextResponse.json({ error: ".cognote 파일이 너무 큽니다." }, { status: 413 });
  }
  if (contentType.includes("multipart/form-data")) {
    if (!contentLength) {
      return NextResponse.json(
        { error: "크기를 확인할 수 없는 multipart 요청은 허용되지 않습니다." },
        { status: 411 }
      );
    }
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: ".cognote 파일을 첨부해 주세요." }, { status: 400 });
    }
    if (file.size > COGNOTE_MAX_FILE_BYTES) {
      return NextResponse.json({ error: ".cognote 파일이 너무 큽니다." }, { status: 413 });
    }
    raw = await file.text();
  } else {
    const reader = request.body?.getReader();
    if (!reader) raw = "";
    else {
      const chunks: Uint8Array[] = [];
      let received = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.byteLength;
        if (received > COGNOTE_MAX_FILE_BYTES) {
          await reader.cancel();
          return NextResponse.json({ error: ".cognote 파일이 너무 큽니다." }, { status: 413 });
        }
        chunks.push(value);
      }
      const joined = new Uint8Array(received);
      let offset = 0;
      for (const chunk of chunks) {
        joined.set(chunk, offset);
        offset += chunk.byteLength;
      }
      raw = new TextDecoder().decode(joined);
    }
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

  try {
    assertCognoteResources(result.data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "가져오기 제한을 확인해 주세요." },
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
