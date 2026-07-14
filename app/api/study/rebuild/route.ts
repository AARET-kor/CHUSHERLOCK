import { NextResponse } from "next/server";
import { rebuildClusters } from "../../../../lib/services/clusterService";

/** POST /api/study/rebuild — recompute all learning clusters from the
 * current library. One model call (Sonnet) over compact note digests. */
export async function POST() {
  try {
    const result = await rebuildClusters();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "학습 묶음 생성에 실패했습니다." },
      { status: 500 }
    );
  }
}
