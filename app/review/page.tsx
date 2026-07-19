import Link from "next/link";
import { listDueCards, flashcardStats } from "../../lib/services/flashcardService";
import { ReviewClient, type ReviewCard } from "../../components/ReviewClient";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const [due, stats] = await Promise.all([listDueCards(60), flashcardStats()]);

  const cards: ReviewCard[] = due.map((c) => ({
    id: c.id,
    entryId: c.entryId,
    entryTitle: c.entryTitle,
    front: c.front,
    back: c.back,
    status: c.status,
    learningStep: c.learningStep,
    easeMilli: c.easeMilli,
    intervalDays: c.intervalDays,
    reps: c.reps,
    lapses: c.lapses,
  }));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-3 font-mono text-[10px] tracking-[0.2em] md:text-[11px]">
            <span className="text-ink/45">[ REVIEW ]</span>
            <span className="font-bold uppercase text-ink">복습 — 간격 반복 학습</span>
          </div>
          <h1 className="font-serifa text-2xl font-bold tracking-tight text-inkdeep md:text-3xl">
            오늘의 <span className="italic">복습</span>
          </h1>
        </div>
        <div className="flex gap-4 text-center">
          <Stat label="복습 대기" value={stats.due} highlight />
          <Stat label="학습 중" value={stats.learning + stats.lapsed} />
          <Stat label="전체 카드" value={stats.total} />
        </div>
      </div>

      {stats.total === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink/15 bg-mist/40 p-12 text-center">
          <p className="text-sm text-ink/50">
            아직 플래시카드가 없습니다.
            <br />
            노트를 열어 <strong className="text-ink/70">카드 만들기</strong>로 핵심을 카드로 만들면,
            여기서 <strong className="text-ink/70">Daily · Weekly · Monthly</strong> 간격으로 반복 복습할 수 있어요.
          </p>
          <Link href="/library" className="btn-secondary mt-5 !px-5 !py-2">
            노트 보러 가기
          </Link>
        </div>
      ) : (
        <ReviewClient initialCards={cards} />
      )}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div>
      <div
        className={`text-2xl font-bold tabular-nums ${highlight && value > 0 ? "text-emerald-600" : "text-inkdeep"}`}
      >
        {value}
      </div>
      <div className="font-mono text-[9px] uppercase tracking-widest text-ink/40">{label}</div>
    </div>
  );
}
