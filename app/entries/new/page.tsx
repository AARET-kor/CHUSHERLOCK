import { getLeafCategories } from "../../../lib/codex/taxonomy";
import { EntryForm } from "../../../components/EntryForm";

export default function NewEntryPage() {
  const leafCategories = getLeafCategories();

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">새 자료 추가</h1>
      <p className="mb-6 text-sm text-neutral-400">
        파라미터, 논문, 책, 노하우 등 무엇이든 넣으세요. 카테고리와 성격(tier)을 지정하면
        같은 주제의 기존 자료와 자동으로 연결됩니다.
      </p>
      <EntryForm leafCategories={leafCategories} />
    </div>
  );
}
