import { NextResponse } from "next/server";
import * as entryService from "../../../../lib/services/entryService";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entry = await entryService.getEntry(id);
  if (!entry) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ entry });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await entryService.deleteEntry(id);
  return NextResponse.json({ ok: true });
}
