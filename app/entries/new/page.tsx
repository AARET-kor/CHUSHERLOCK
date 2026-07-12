import { getLeafCategories } from "../../../lib/codex/taxonomy";
import { EntryForm } from "../../../components/EntryForm";

export default function NewEntryPage() {
  const leafCategories = getLeafCategories();

  return (
    <div>
      <h1 className="mb-1 text-2xl tracking-tight text-inkdeep">빠른 <span className="font-serifa font-bold">메모</span></h1>
      <p className="mb-6 text-sm text-ink/60">
        진료 사이에 30초 — 방금 배운 팁, 세미나에서 들은 파라미터, 환자에게 잘 먹힌 멘트를
        바로 적어 두세요. 제목·출처는 비워도 되고, 같은 주제의 기존 노트와 자동으로 연결됩니다.
      </p>
      <EntryForm leafCategories={leafCategories} />
    </div>
  );
}
