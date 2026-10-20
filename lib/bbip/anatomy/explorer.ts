import type { AtlasStructure, Shape } from "./atlas";
import { ATLAS_VIEWBOX } from "./atlas";
import { RISKS, type DepthKey } from "./layers";

/** Search authored names and aliases, never inferred clinical relationships. */
export function searchStructures(structures: AtlasStructure[], query: string): AtlasStructure[] {
  const words = query.normalize("NFKC").toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  return structures
    .filter((s) => {
      const text = [s.ko, s.en, ...s.keywords].join(" ").normalize("NFKC").toLocaleLowerCase();
      return words.every((word) => text.includes(word));
    })
    .sort((a, b) => RISKS[a.risk].rank - RISKS[b.risk].rank);
}

export function inDepth(structure: AtlasStructure, depth: DepthKey | null): boolean {
  return depth === null || structure.depths.includes(depth);
}

/** Shared depth is a categorical association, not proof of spatial adjacency. */
export function sharedDepthStructures(selected: AtlasStructure, structures: AtlasStructure[]): AtlasStructure[] {
  return structures.filter(
    (s) => s.id !== selected.id && s.layer !== "entry" && s.depths.some((d) => selected.depths.includes(d))
  ).sort((a, b) => RISKS[a.risk].rank - RISKS[b.risk].rank);
}

/** Fit authored/projected region shapes, maintaining the atlas aspect ratio. */
export function regionViewBox(shapes: Shape[]): string {
  const points = shapes.flatMap((s) =>
    s.kind === "point" ? [s.at] : s.kind === "vector" ? [s.from, s.to] : s.pts
  );
  const { width, height } = ATLAS_VIEWBOX;
  if (!points.length) return `0 0 ${width} ${height}`;
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const w = Math.min(width, Math.max(80, maxX - minX + 28, (maxY - minY + 28) * width / height));
  const h = w * height / width;
  const x = Math.max(0, Math.min(width - w, (minX + maxX - w) / 2));
  const y = Math.max(0, Math.min(height - h, (minY + maxY - h) / 2));
  return [x, y, w, h].map((n) => Math.round(n * 10) / 10).join(" ");
}
