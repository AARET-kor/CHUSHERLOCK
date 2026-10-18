import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../../../../lib/db/client";
import { entryClaims } from "../../../../lib/db/schema";

const claimReviewSchema = z.object({
  conflictStatus: z.enum(["none", "possible", "confirmed"]),
  conflictNote: z.string().max(2000).optional(),
  reviewer: z.string().min(1).max(200),
  verified: z.boolean().default(false),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const parsed = claimReviewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "claim 검토 입력값을 확인해 주세요." }, { status: 400 });
  }
  const [existing] = await db
    .select({ id: entryClaims.id })
    .from(entryClaims)
    .where(eq(entryClaims.id, id));
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  await db
    .update(entryClaims)
    .set({
      conflictStatus: parsed.data.conflictStatus,
      conflictNote: parsed.data.conflictNote || null,
      verifiedBy: parsed.data.verified ? parsed.data.reviewer : null,
      verifiedAt: parsed.data.verified ? new Date().toISOString() : null,
    })
    .where(eq(entryClaims.id, id));
  return NextResponse.json({ ok: true });
}
