import { getCategory, getCategoryPath } from "../lib/codex/taxonomy";

export function CategoryBadge({ categoryKey }: { categoryKey: string }) {
  const category = getCategory(categoryKey);
  return (
    <span
      className="inline-block rounded-full border border-ink/10 bg-mist px-2.5 py-0.5 text-xs text-ink/70"
      title={getCategoryPath(categoryKey)}
    >
      {category.labelKo} / {category.labelEn}
    </span>
  );
}
