// app/papers/journals/page.tsx
import Link from "next/link";
import { JournalTable } from "../../../components/papers/JournalTable";
import { listJournals } from "../../../lib/services/paperService";

export const dynamic = "force-dynamic";

export default function JournalsPage() {
  return (
    <div className="max-w-[820px]">
      <Link href="/papers" className="text-[14px] text-ink/60 hover:text-ink">← Papers · 논문</Link>
      <h1 className="mt-5 font-serifa text-3xl font-bold text-inkdeep">Journals · 저널 표</h1>
      <p className="mt-2 mb-6 text-sm text-ink/65">
        처음 값은 검증되지 않은 근사값입니다. JCR 값으로 고치면 논문 목록 정렬에 바로 반영됩니다. 칸을 비우면 목록 맨 아래로 갑니다.
      </p>
      <JournalTable journals={listJournals()} />
    </div>
  );
}
