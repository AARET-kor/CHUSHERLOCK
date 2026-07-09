import { getCategory, getCategoryPath } from "../lib/codex/taxonomy";

export function CategoryBadge({ categoryKey }: { categoryKey: string }) {
  const category = getCategory(categoryKey);
  return (
    <span
      className="inline-block rounded border border-neutral-700 bg-neutral-900 px-2 py-0.5 text-xs text-neutral-300"
      title={getCategoryPath(categoryKey)}
    >
      {category.labelKo} / {category.labelEn}
    </span>
  );
}
