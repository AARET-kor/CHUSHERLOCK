import type { CodexEntry } from "./types";
import { getCategory, getCategoryPath } from "./taxonomy";
import { getTierInfo } from "./tiers";
import { applyDecorations } from "./decorations";

export interface MarkdownExportFile {
  /** Vault-relative path, including the category folder path and filename. */
  relativePath: string;
  content: string;
}

function sanitizeFilename(title: string): string {
  return title
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function yamlStringList(items: string[]): string {
  if (items.length === 0) return "[]";
  return "\n" + items.map((item) => `  - ${JSON.stringify(item)}`).join("\n");
}

/**
 * Converts one entry into an Obsidian-ready Markdown file: YAML frontmatter
 * (tags/category/tier/sources for Obsidian's metadata + search), a tier
 * callout so the reader immediately knows what kind of knowledge this is,
 * the full bilingual body (never truncated), a related-notes wikilink
 * section (so overlapping topics interlink instead of duplicating), and an
 * explicit sources section.
 */
export function entryToMarkdown(
  entry: CodexEntry,
  titleById: Map<string, string>
): MarkdownExportFile {
  const category = getCategory(entry.categoryKey);
  const categoryPath = getCategoryPath(entry.categoryKey);
  const tierInfo = getTierInfo(entry.tier);

  const tags = ["codex", `tier/${entry.tier}`, `category/${entry.categoryKey}`, ...entry.tags];

  const relatedTitles = entry.relatedEntryIds
    .map((id) => titleById.get(id))
    .filter((title): title is string => Boolean(title));

  const sourceYamlLines = entry.sources.map((source) => {
    const label = [source.citation, source.authors, source.year ? String(source.year) : undefined]
      .filter(Boolean)
      .join(", ");
    return `  - ${JSON.stringify(source.url ? `${label} (${source.url})` : label)}`;
  });

  const frontmatter = [
    "---",
    `title: ${JSON.stringify(entry.title)}`,
    `category: ${JSON.stringify(categoryPath)}`,
    `category_label: ${JSON.stringify(`${category.labelKo} / ${category.labelEn}`)}`,
    `tier: ${entry.tier}`,
    `tier_label: ${JSON.stringify(`${tierInfo.labelKo} / ${tierInfo.labelEn}`)}`,
    `status: ${entry.status}`,
    `created: ${entry.createdAt}`,
    `updated: ${entry.updatedAt}`,
    `tags:${yamlStringList(tags)}`,
    sourceYamlLines.length > 0 ? `sources:\n${sourceYamlLines.join("\n")}` : "sources: []",
    "---",
  ].join("\n");

  const relatedSection =
    relatedTitles.length > 0
      ? ["", "## 관련 노트 (Related Notes)", "", ...relatedTitles.map((title) => `- [[${title}]]`)].join(
          "\n"
        )
      : "";

  const sourceSection =
    entry.sources.length > 0
      ? [
          "",
          "## 출처 (Sources)",
          "",
          ...entry.sources.map((source) => `- ${source.citation}${source.url ? ` — ${source.url}` : ""}`),
        ].join("\n")
      : "";

  const content = [
    frontmatter,
    "",
    `# ${entry.title}`,
    "",
    `> **${tierInfo.labelKo} / ${tierInfo.labelEn}** — ${tierInfo.descriptionKo}`,
    "",
    // Obsidian renders inline HTML, so color decorations travel as
    // inline-styled tags inside the markdown body.
    applyDecorations(entry.content.trim(), "inline"),
    relatedSection,
    sourceSection,
    "",
  ].join("\n");

  return {
    relativePath: `${categoryPath}/${sanitizeFilename(entry.title)}.md`,
    content,
  };
}

export function entriesToMarkdownFiles(entryList: CodexEntry[]): MarkdownExportFile[] {
  const titleById = new Map(entryList.map((entry) => [entry.id, entry.title]));
  return entryList.map((entry) => entryToMarkdown(entry, titleById));
}
