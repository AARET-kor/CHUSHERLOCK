import { NextResponse } from "next/server";
import { updateEntrySchema } from "../../../../lib/schemas/entrySchemas";
import * as entryService from "../../../../lib/services/entryService";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entry = await entryService.getEntry(id);
  if (!entry) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ entry });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const parsed = updateEntrySchema.safeParse({ ...body, id });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요." },
      { status: 400 }
    );
  }
  const existing = await entryService.getEntry(id);
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  const entry = await entryService.updateEntry(parsed.data);
  return NextResponse.json({ entry });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await entryService.deleteEntry(id);
  return NextResponse.json({ ok: true });
}
