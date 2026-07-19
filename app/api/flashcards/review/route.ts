import { NextResponse } from "next/server";
import { reviewCard } from "../../../../lib/services/flashcardService";
import type { Rating } from "../../../../lib/srs/scheduler";

const RATINGS: Rating[] = ["again", "hard", "good", "easy"];

/** POST /api/flashcards/review { cardId, rating } — grade a card; the SM-2
 * scheduler sets its next due time. Returns the human due label. */
export async function POST(request: Request) {
  let cardId = "";
  let rating: string = "";
  try {
    const body = await request.json();
    cardId = String(body.cardId ?? "");
    rating = String(body.rating ?? "");
  } catch {
    /* validated below */
  }
  if (!cardId || !RATINGS.includes(rating as Rating)) {
    return NextResponse.json({ error: "cardId와 올바른 rating이 필요합니다." }, { status: 400 });
  }
  const result = await reviewCard(cardId, rating as Rating);
  if (!result) return NextResponse.json({ error: "카드를 찾을 수 없습니다." }, { status: 404 });
  return NextResponse.json(result);
}
