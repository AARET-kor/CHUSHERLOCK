import { z } from "zod";
import { getStructure } from "../../../../../lib/bbip/anatomy/atlas";
import { getEntry, updateEntry } from "../../../../../lib/services/entryService";
const schema = z.object({ structureId: z.string(), linked: z.boolean() });
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !getStructure(parsed.data.structureId)) return Response.json({ error: "해부 구조를 확인해 주세요." }, { status: 400 });
  const entry = await getEntry((await params).id);
  if (!entry) return Response.json({ error: "노트를 찾을 수 없습니다." }, { status: 404 });
  const tag = `anatomy:${parsed.data.structureId}`;
  const tags = entry.tags.filter(t => t !== tag);
  if (parsed.data.linked) tags.push(tag);
  const updated = await updateEntry({ id: entry.id, tags, changeNote: "해부 구조 연결 변경" });
  return Response.json({ tags: updated.tags });
}
