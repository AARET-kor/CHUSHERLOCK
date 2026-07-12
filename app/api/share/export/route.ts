import { NextRequest, NextResponse } from "next/server";
import { buildCognote } from "../../../../lib/share/cognote";

/** GET /api/share/export?ids=a,b,c — download selected notes as a
 * self-contained .cognote file for sharing with other people. */
export async function GET(request: NextRequest) {
  const idsParam = request.nextUrl.searchParams.get("ids") ?? "";
  const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean);
  if (ids.length === 0) {
    return NextResponse.json({ error: "공유할 노트를 선택해 주세요." }, { status: 400 });
  }

  const file = await buildCognote(ids);
  if (file.notes.length === 0) {
    return NextResponse.json({ error: "선택한 노트를 찾을 수 없습니다." }, { status: 404 });
  }

  const filename =
    file.notes.length === 1 ? `${file.notes[0]!.title.slice(0, 60)}.cognote` : "cognitio-notes.cognote";

  return new NextResponse(JSON.stringify(file, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
