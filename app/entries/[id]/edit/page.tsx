import { notFound } from "next/navigation";
import { getEntry } from "../../../../lib/services/entryService";
import { getLeafCategories } from "../../../../lib/codex/taxonomy";
import { EntryEditForm } from "../../../../components/EntryEditForm";

export default async function EntryEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const entry = await getEntry(id);
  if (!entry) notFound();

  return (
    <div>
      <h1 className="mb-1 text-2xl tracking-tight text-inkdeep">
        노트 <span className="font-serifa font-bold">수정</span>
      </h1>
      <p className="mb-6 text-sm text-ink/60">
        출처는 자료의 이력이므로 여기서 바꾸지 않습니다. 내용을 정리하거나 카테고리/성격을 바로잡는
        용도로 쓰세요.
      </p>
      <EntryEditForm entry={entry} leafCategories={getLeafCategories()} />
    </div>
  );
}
