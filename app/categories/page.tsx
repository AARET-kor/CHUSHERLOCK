import { getTopLevelCategories, getChildCategories } from "../../lib/codex/taxonomy";

export default function CategoriesPage() {
  const topLevel = getTopLevelCategories();

  return (
    <div>
      <h1 className="mb-2 text-2xl tracking-tight text-inkdeep">분류체계 <span className="font-serifa font-bold">(Taxonomy)</span></h1>
      <p className="mb-6 text-sm text-ink/60">
        자료는 이 분류체계의 leaf 카테고리에 배정됩니다. 새로운 하위 카테고리는
        <code className="mx-1 rounded bg-mist px-1">lib/codex/taxonomy.ts</code>
        에 추가하면 됩니다.
      </p>
      <div className="space-y-6">
        {topLevel.map((parent) => {
          const children = getChildCategories(parent.key);
          return (
            <div key={parent.key} className="card p-5">
              <h2 className="font-serifa font-bold text-ink">
                {parent.labelKo} <span className="text-ink/50">/ {parent.labelEn}</span>
              </h2>
              {parent.descriptionKo && (
                <p className="mt-1 text-sm text-ink/60">{parent.descriptionKo}</p>
              )}
              {children.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {children.map((child) => (
                    <li
                      key={child.key}
                      className="rounded border border-ink/15 bg-mist px-2 py-1 text-xs text-ink/80"
                    >
                      {child.labelKo} / {child.labelEn}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
