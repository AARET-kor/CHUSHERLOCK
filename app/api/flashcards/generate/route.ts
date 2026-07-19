import { NextResponse } from "next/server";
import { generateCardsForEntry } from "../../../../lib/services/flashcardService";

/** POST /api/flashcards/generate { entryId, regenerate? } — extract
 * spaced-repetition cards from a note (Sonnet). */
export async function POST(request: Request) {
  let entryId = "";
  let regenerate = false;
  try {
    const body = await request.json();
    entryId = String(body.entryId ?? "");
    regenerate = Boolean(body.regenerate);
  } catch {
    /* validated below */
  }
  if (!entryId) {
    return NextResponse.json({ error: "노트 id가 필요합니다." }, { status: 400 });
  }
  try {
    const result = await generateCardsForEntry(entryId, { regenerate });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "카드 생성에 실패했습니다." },
      { status: 500 }
    );
  }
}
