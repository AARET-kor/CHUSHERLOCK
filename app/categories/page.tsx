import { getTopLevelCategories, getChildCategories } from "../../lib/codex/taxonomy";

export default function CategoriesPage() {
  const topLevel = getTopLevelCategories();

  return (
    <div>
      <h1 className="mb-2 text-xl font-semibold">분류체계 (Taxonomy)</h1>
      <p className="mb-6 text-sm text-neutral-400">
        자료는 이 분류체계의 leaf 카테고리에 배정됩니다. 새로운 하위 카테고리는
        <code className="mx-1 rounded bg-neutral-900 px-1">lib/codex/taxonomy.ts</code>
        에 추가하면 됩니다.
      </p>
      <div className="space-y-6">
        {topLevel.map((parent) => {
          const children = getChildCategories(parent.key);
          return (
            <div key={parent.key} className="rounded-lg border border-neutral-800 p-4">
              <h2 className="font-medium">
                {parent.labelKo} <span className="text-neutral-500">/ {parent.labelEn}</span>
              </h2>
              {parent.descriptionKo && (
                <p className="mt-1 text-sm text-neutral-400">{parent.descriptionKo}</p>
              )}
              {children.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {children.map((child) => (
                    <li
                      key={child.key}
                      className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-300"
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
