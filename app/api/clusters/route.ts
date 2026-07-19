import { NextResponse } from "next/server";
import { createManualCluster } from "../../../lib/services/clusterService";

/** POST /api/clusters { title, description?, entryIds[] } — create a
 * hand-curated learning cluster. */
export async function POST(request: Request) {
  let body: { title?: string; description?: string; entryIds?: string[] } = {};
  try {
    body = await request.json();
  } catch {
    /* validated below */
  }
  const entryIds = Array.isArray(body.entryIds) ? body.entryIds.filter(Boolean) : [];
  if (entryIds.length === 0) {
    return NextResponse.json({ error: "묶을 노트를 선택해 주세요." }, { status: 400 });
  }
  try {
    const id = await createManualCluster({
      title: String(body.title ?? "").trim() || "새 학습 묶음",
      description: body.description,
      entryIds,
    });
    return NextResponse.json({ id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "생성에 실패했습니다." },
      { status: 500 }
    );
  }
}
