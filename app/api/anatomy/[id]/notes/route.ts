import { inArray } from "drizzle-orm";
import { getStructure } from "../../../../../lib/bbip/anatomy/atlas";
import { db } from "../../../../../lib/db/client";
import { figures } from "../../../../../lib/db/schema";
import { listEntries } from "../../../../../lib/services/entryService";
import { noteExcerpt } from "../../../../../lib/knowledge/preview";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!getStructure(id)) return Response.json({ error: "구조를 찾을 수 없습니다." }, { status: 404 });
  const entries = (await listEntries()).filter(e => e.tags.includes(`anatomy:${id}`));
  const images = entries.length ? db.select({ id: figures.id, entryId: figures.entryId, caption: figures.caption, page: figures.page }).from(figures).where(inArray(figures.entryId, entries.map(e => e.id))).all() : [];
  return Response.json({ notes: entries.map(e => ({ id: e.id, title: e.title, status: e.status, excerpt: noteExcerpt(e.content), figures: images.filter(f => f.entryId === e.id) })) });
}
