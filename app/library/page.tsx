import { listEntries } from "../../lib/services/entryService";
import { CATEGORY_TAXONOMY } from "../../lib/codex/taxonomy";
import { LibraryClient } from "../../components/LibraryClient";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const entries = await listEntries();

  return (
    <div>
      <h1 className="mb-1 text-2xl tracking-tight text-inkdeep">
        라이브러리 <span className="font-serifa font-bold">— 폴더로 보기</span>
      </h1>
      <p className="mb-6 text-sm text-ink/60">
        분류체계 폴더를 열어 노트를 탐색하세요. 노트를 선택하면 합치기·삭제 등 정리 작업을 할 수
        있습니다.
      </p>
      <LibraryClient entries={entries} taxonomy={CATEGORY_TAXONOMY} />
    </div>
  );
}
