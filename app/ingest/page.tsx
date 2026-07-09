import { getLeafCategories } from "../../lib/codex/taxonomy";
import { IngestClient } from "../../components/IngestClient";

export default function IngestPage() {
  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">자료 넣기 (AI 자동 분류)</h1>
      <p className="mb-6 text-sm text-neutral-400">
        논문, 교과서, 파라미터 시트, 노하우 등 원문을 통째로 넣으면 AI가 문서 흐름을 따라 읽고
        카테고리/성격(tier)별로 나눠 정리안을 제안합니다. 요약으로 뭉개지 않고 파라미터·수치·순서를
        보존합니다. 제안을 확인·수정한 뒤 저장하세요.
      </p>
      <IngestClient leafCategories={getLeafCategories()} />
    </div>
  );
}
