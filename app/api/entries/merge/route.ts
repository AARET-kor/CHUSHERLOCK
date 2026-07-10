import { NextResponse } from "next/server";
import { z } from "zod";
import { mergeEntries } from "../../../../lib/services/entryService";
import { contentTierSchema } from "../../../../lib/schemas/entrySchemas";

const mergeSchema = z.object({
  entryIds: z.array(z.string()).min(2, "합칠 노트를 2개 이상 선택해 주세요."),
  title: z.string().min(2, "제목을 입력해 주세요."),
  categoryKey: z.string().min(1),
  tier: contentTierSchema,
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = mergeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요." },
      { status: 400 }
    );
  }

  try {
    const entry = await mergeEntries(parsed.data);
    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "합치기에 실패했습니다." },
      { status: 400 }
    );
  }
}
