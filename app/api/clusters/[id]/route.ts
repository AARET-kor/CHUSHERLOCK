import { NextResponse } from "next/server";
import { updateCluster, deleteCluster } from "../../../../lib/services/clusterService";

/** PATCH /api/clusters/[id] — edit title/description/suggestions/notes.
 * Editing converts an AI cluster to manual so it survives a rebuild. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: {
    title?: string;
    description?: string;
    suggestions?: string[];
    entryIds?: string[];
  } = {};
  try {
    body = await request.json();
  } catch {
    /* no-op */
  }
  try {
    await updateCluster(id, body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "수정에 실패했습니다." },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await deleteCluster(id);
  return NextResponse.json({ ok: true });
}
