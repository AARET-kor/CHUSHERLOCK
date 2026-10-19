import { ATLAS_VIEWBOX, FACE_GUIDES, type AtlasStructure, type Pt, type Shape } from "./atlas";
import type { ViewKey } from "./layers";

// Front-view atlas points → oblique (45°) and lateral views. Each point
// (x, y) sits on an elliptic head section at height y: half-width a(y) from
// the front outline, a front depth (ear plane → facial surface) and a back
// depth (ear plane → occiput/neck) from profile tables, plus a forward relief
// p for the nose, lips and chin. The head turns so the face looks toward the viewer's left
// (the drawn side, x > 120, comes into view). Points rotated behind the head
// are hidden. Deterministic and model-free: the curated truth is the front
// view; these are renderings of it.

const MID = ATLAS_VIEWBOX.width / 2;
const MID_Y = ATLAS_VIEWBOX.height / 2;

// Distance from the coronal plane through the ears to the skin, at height y
// (front-view units): forward to the midline face, backward to the occiput
// above the ear and to the neck below it.
const FRONT_DEPTH: Pt[] = [
  [22, 6], [28, 52], [40, 82], [60, 105], [90, 117], [120, 115], [150, 118], [180, 120],
  [210, 117], [240, 110], [262, 104], [276, 92],
];
const BACK_DEPTH: Pt[] = [
  [22, 6], [28, 56], [40, 88], [60, 110], [90, 120], [120, 118], [150, 106], [180, 84],
  [210, 60], [240, 46], [276, 40],
];

function interpolate(table: Pt[], y: number): number {
  if (y <= table[0]![0]) return table[0]![1];
  for (let i = 1; i < table.length; i++) {
    const [y1, v1] = table[i]!;
    const [y0, v0] = table[i - 1]!;
    if (y <= y1) return v0 + ((v1 - v0) * (y - y0)) / (y1 - y0);
  }
  return table[table.length - 1]![1];
}

interface ViewParams {
  phi: number;
  scale: number;
  cx: number;
}

const VIEW_PARAMS: Record<Exclude<ViewKey, "front">, ViewParams> = {
  oblique: { phi: Math.PI / 4, scale: 0.95, cx: 122 },
  lateral: { phi: Math.PI / 2, scale: 0.84, cx: 136 },
};

// Right half of the outline, top → bottom (y increasing).
const HALF = FACE_GUIDES.outline.filter(([x]) => x >= MID);

export function halfWidth(y: number): number {
  if (y <= HALF[0]![1] || y >= HALF[HALF.length - 1]![1]) return 0;
  for (let i = 1; i < HALF.length; i++) {
    const [x1, y1] = HALF[i]!;
    const [x0, y0] = HALF[i - 1]!;
    if (y <= y1) return x0 + ((x1 - x0) * (y - y0)) / (y1 - y0) - MID;
  }
  return 0;
}

/** Forward protrusion of the nose, lips and chin (front-view units). */
export function relief(u: number, y: number): number {
  const au = Math.abs(u);
  let p = 0;
  if (y >= 118 && y <= 188 && au < 16) {
    const along = y <= 178 ? 5 + (22 * (y - 118)) / 60 : 27 * (1 - (y - 178) / 10);
    p = Math.max(p, Math.max(0, along) * (1 - au / 16));
  }
  if (y >= 196 && y <= 232 && au < 30) p = Math.max(p, 7 * (1 - au / 30) * Math.sin((Math.PI * (y - 196)) / 36));
  if (y >= 234 && y <= 274 && au < 30) p = Math.max(p, 6 * (1 - au / 30) * Math.sin((Math.PI * (y - 234)) / 40));
  return p;
}

function rotate(a: number, theta: number, p: number, view: ViewParams, y: number): Pt {
  const X = a * Math.sin(theta);
  const c = Math.cos(theta);
  const Z = interpolate(c >= 0 ? FRONT_DEPTH : BACK_DEPTH, y) * c + p;
  const x = view.cx + view.scale * (X * Math.cos(view.phi) - Z * Math.sin(view.phi));
  return [round(x), round(MID_Y + view.scale * (y - MID_Y))];
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

export function projectPoint(pt: Pt, view: ViewKey): Pt | null {
  if (view === "front") return [pt[0], pt[1]];
  const params = VIEW_PARAMS[view];
  const [x, y] = pt;
  const u = x - MID;
  const a = Math.max(halfWidth(y), Math.abs(u), 1);
  const theta = Math.asin(Math.max(-1, Math.min(1, u / a)));
  if (theta - params.phi < -Math.PI / 2 - 0.02) return null;
  return rotate(a, theta, relief(u, y), params, y);
}

export function mirrorShape(shape: Shape): Shape {
  const m = ([x, y]: Pt): Pt => [ATLAS_VIEWBOX.width - x, y];
  switch (shape.kind) {
    case "point":
      return { kind: "point", at: m(shape.at) };
    case "vector":
      return { kind: "vector", from: m(shape.from), to: m(shape.to) };
    default:
      return { kind: shape.kind, pts: shape.pts.map(m) };
  }
}

export function projectShape(shape: Shape, view: ViewKey): Shape | null {
  if (view === "front") return shape;
  switch (shape.kind) {
    case "point": {
      const at = projectPoint(shape.at, view);
      return at ? { kind: "point", at } : null;
    }
    case "vector": {
      const from = projectPoint(shape.from, view);
      const to = projectPoint(shape.to, view);
      return from && to ? { kind: "vector", from, to } : null;
    }
    default: {
      const pts = shape.pts.map((p) => projectPoint(p, view)).filter((p): p is Pt => p !== null);
      return pts.length >= (shape.kind === "area" ? 3 : 2) ? { kind: shape.kind, pts } : null;
    }
  }
}

/** Both sides of the face (drawn side + mirror), projected for the view. */
function bilateral(shapes: Shape[], view: ViewKey): Shape[] {
  return [...shapes, ...shapes.map(mirrorShape)]
    .map((s) => projectShape(s, view))
    .filter((s): s is Shape => s !== null);
}

export function shapesFor(structure: Pick<AtlasStructure, "shapes">, view: ViewKey): Shape[] {
  const explicit = view === "front" ? undefined : structure.shapes[view];
  if (explicit) return explicit;
  return bilateral(structure.shapes.front ?? [], view);
}

export function areaFor(pts: Pt[], view: ViewKey): Shape[] {
  return bilateral([{ kind: "area", pts }], view);
}

export function featuresFor(view: ViewKey): Shape[] {
  return bilateral(FACE_GUIDES.features, view);
}

/** Closed silhouette for the view. */
export function viewOutline(view: ViewKey): Pt[] {
  if (view === "front") return FACE_GUIDES.outline;
  const params = VIEW_PARAMS[view];
  const left: Pt[] = [];
  const right: Pt[] = [];
  const top = HALF[0]![1];
  const bottom = HALF[HALF.length - 1]![1];
  for (let y = top + 2; y <= bottom - 1; y += 4) {
    const a = halfWidth(y);
    let min: Pt | null = null;
    let max: Pt | null = null;
    for (let i = 0; i <= 72; i++) {
      const theta = -Math.PI + (i * 2 * Math.PI) / 72;
      const u = a * Math.sin(theta);
      const p = Math.abs(theta) < Math.PI / 2 ? relief(u, y) : 0;
      const pt = rotate(a, theta, p, params, y);
      if (!min || pt[0] < min[0]) min = pt;
      if (!max || pt[0] > max[0]) max = pt;
    }
    left.push(min!);
    right.push(max!);
  }
  return [...left, ...right.reverse()];
}

/** The ear, drawn per view (outside the face outline, so not projected). */
export function earFor(view: ViewKey): Shape[] {
  const ear = (dx: number, w: number): Pt[] => [
    [dx, 116], [dx + w * 0.7, 113], [dx + w, 124], [dx + w * 0.9, 146], [dx + w * 0.55, 164], [dx, 168],
  ];
  if (view === "front") {
    const right: Shape = { kind: "area", pts: ear(207, 11) };
    return [right, mirrorShape(right)];
  }
  const root = projectPoint([MID + halfWidth(140), 140], view)!;
  const params = VIEW_PARAMS[view];
  const w = view === "lateral" ? 22 : 14;
  const pts = ear(0, w).map(([x, y]): Pt => [round(root[0] + x * params.scale), round(MID_Y + params.scale * (y - MID_Y))]);
  return [{ kind: "area", pts }];
}

function fmt(n: number): string {
  return String(Math.round(n * 10) / 10);
}

/** Catmull-Rom spline through the points as cubic Bézier segments. */
export function smoothPath(pts: readonly Pt[], closed: boolean): string {
  if (pts.length === 0) return "";
  const [x0, y0] = pts[0]!;
  if (pts.length === 2 && !closed) return `M${fmt(x0)},${fmt(y0)} L${fmt(pts[1]![0])},${fmt(pts[1]![1])}`;
  const n = pts.length;
  const at = (i: number): Pt => (closed ? pts[(i + n) % n]! : pts[Math.max(0, Math.min(n - 1, i))]!);
  const segments = closed ? n : n - 1;
  let d = `M${fmt(x0)},${fmt(y0)}`;
  for (let i = 0; i < segments; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${fmt(c1[0])},${fmt(c1[1])} ${fmt(c2[0])},${fmt(c2[1])} ${fmt(p2[0])},${fmt(p2[1])}`;
  }
  return closed ? `${d} Z` : d;
}

/** Where to pin a tooltip for these shapes. */
export function anchorOf(shapes: Shape[]): Pt | null {
  const first = shapes[0];
  if (!first) return null;
  if (first.kind === "point") return first.at;
  if (first.kind === "vector") return first.from;
  if (first.kind === "line") return first.pts[Math.floor(first.pts.length / 2)]!;
  const sx = first.pts.reduce((s, p) => s + p[0], 0);
  const sy = first.pts.reduce((s, p) => s + p[1], 0);
  return [round(sx / first.pts.length), round(sy / first.pts.length)];
}
