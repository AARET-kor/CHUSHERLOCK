# BBIP Anatomy Map Implementation Plan (Plan 3 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 주사·캐뉼라 시술 케이스에서 🧭 해부 지도 카드를 AI 호출 없이 즉시 띄운다. 얼굴 도식(정면/45°/측면, 레이어 토글), 깊이 단면도(권장 평면 밴드), 위험 구조물 표, 내 자료 그림을 보여 주고, 모델 출력의 `{{atlas:id}}` 토큰은 칩이 되어 지도에서 해당 구조물을 강조한다.

**Architecture:** 해부 데이터는 정적 큐레이션 아틀라스(`lib/bbip/anatomy/*`)다. 좌표는 **정면 뷰 한 벌만** 손으로 작성하고, 45°/측면은 결정론적 투영(`geometry.ts`)으로 그린다(모델이 좌표를 만들지 않는다). 시술 칩 → 시술 분류 → 부위 매핑(`regions.ts`)도 결정론적이며 세션 칩에서 매번 계산하므로 DB 컬럼이 필요 없다. 프롬프트에는 부위 구조물의 id·이름·깊이·위험 요약만 들어간다(`prompt.ts`, 캐시 블록 ②). UI는 `components/bbip/anatomy/*` 클라이언트 컴포넌트다.

**Tech Stack:** Next.js 15 App Router, TypeScript, React 18, Tailwind, lucide-react, marked(인라인 확장), Drizzle + better-sqlite3(figures 조회), Vitest, Playwright + Axe.

**Spec:** `docs/superpowers/specs/2026-10-18-bbip-design.md` §5 (§5.4 AI 연결, §9 "아틀라스 매핑 없는 시술 → 카드 숨김", §10 anatomy 테스트)

**선행:** Plan 1(core)이 `main`에 머지되어 있어야 한다(518e468).

**Plan 2(문헌)와의 경계:** `lib/bbip/literature/*`와 문헌 마이그레이션은 건드리지 않는다. 공유 파일(`evidence.ts`, `prompts.ts`, `context.ts`, `generate.ts`)은 **작은 훅만** 추가해 머지 충돌 면적을 줄인다.

**스펙 대비 단순화 (의도적):**
- `bbip_sessions.anatomy_regions` 컬럼을 만들지 않는다. 부위는 `anatomyPlanFor(session.chips)`로 매번 결정론적으로 계산된다(같은 칩 → 같은 부위). 마이그레이션이 없으므로 Plan 2의 마이그레이션과 충돌하지 않는다.
- 45°/측면 좌표는 정면 좌표를 머리 타원체에 올려 회전·투영한 값이다. 원장 검토 대상은 정면 좌표와 텍스트(주행·깊이·위험·안전 술기)다. 구조물별 `shapes.oblique` / `shapes.lateral`을 직접 적으면 투영 대신 그 값이 쓰인다.
- body-filler(얼굴 외 부위)는 v1 아틀라스에 도식이 없으므로 카드를 띄우지 않는다(§9 "매핑 없는 시술 → 숨김"). 얼굴 부위 키워드가 같이 있으면 face-filler로 처리된다.
- 스킨보톡스(진피 내 미세 주입)·다한증 보톡스는 근육 지도가 의미가 없어 제외한다. 엑소좀·MTS 도포처럼 주사가 아닌 부스터도 제외한다.
- 위험 구조물 표의 "근거" 열은 아틀라스 출처(초안) + 세션 노트 제목이 구조물 키워드와 맞으면 📚n 링크로 표시한다. 외부 문헌 인용은 만들어 넣지 않는다(지어낸 인용 방지).
- 툴팁은 구조물을 호버/포커스/탭했을 때 지도 위에 뜨는 정보 카드로 구현하고, 같은 내용을 `aria-live` 영역에도 쓴다(키보드·스크린리더 접근).

---

## File Structure

| 파일 | 책임 |
|---|---|
| `lib/bbip/anatomy/layers.ts` | 어휘: `ViewKey`, `LayerKey`, `DepthKey`, `RiskLevel`, `ProcedureCategory`와 라벨·색·정렬 |
| `lib/bbip/anatomy/atlas.ts` | 구조물 아틀라스(정면 좌표, 깊이, 위험, 주행, 안전 술기, 키워드, 검토 필드), 얼굴 가이드 선 |
| `lib/bbip/anatomy/regions.ts` | 8개 부위(구조물 id, 강조 영역, 시술별 권장 평면), 칩 → 시술 분류·부위 → `AnatomyPlan` |
| `lib/bbip/anatomy/geometry.ts` | 정면 좌표 → 45°/측면 투영, 뷰 실루엣, 부드러운 SVG path |
| `lib/bbip/anatomy/tokens.ts` | `{{atlas:id}}` 정규식, 노트용 평문 치환, 칩 HTML |
| `lib/bbip/anatomy/prompt.ts` | 프롬프트용 `<atlas>` 블록 |
| `lib/bbip/anatomy/figures.ts` | figure 캡션 해부 점수, 선별(순수) |
| `lib/bbip/anatomy/figureQuery.ts` | 세션 노트들의 figures 조회(DB) |
| `app/api/bbip/sessions/[id]/figures/route.ts` | GET 내 자료 그림 |
| `lib/bbip/evidence.ts` (수정) | `{{atlas:id}}` 인라인 확장, 노트 평문 변환 |
| `lib/bbip/prompts.ts` (수정) | `neutralizeTags`에 `atlas` 추가 |
| `lib/bbip/context.ts` (수정) | 캐시 블록 ②에 `<atlas>` 블록 |
| `lib/bbip/generate.ts` (수정) | fake 브리핑에 아틀라스 토큰 한 줄 |
| `components/bbip/anatomy/AnatomyCard.tsx` | 카드 컨테이너: 부위·시술 선택, 검토 배지, 포커스 동기화 |
| `components/bbip/anatomy/FaceMap.tsx` | 뷰 탭, 레이어 토글, SVG 지도, 툴팁 |
| `components/bbip/anatomy/DepthCrossSection.tsx` | 층 스택 + 구조물 깊이 + 권장 평면 밴드 |
| `components/bbip/anatomy/StructureTable.tsx` | 위험순 표 |
| `components/bbip/anatomy/MyFigures.tsx` | 내 자료 그림 썸네일 + 확대 다이얼로그 |
| `components/bbip/anatomy/ReviewBadge.tsx` | "원장 검토 전 초안" 배지 |
| `components/bbip/EvidenceMarkdown.tsx`, `TurnCard.tsx`, `BbipConsole.tsx` (수정) | 아틀라스 칩 클릭 → 지도 포커스 |
| `app/globals.css` (수정) | `.ev-atlas` |
| `tests/bbip-anatomy-*.test.ts`, `tests/e2e/bbip-anatomy.e2e.ts` | 테스트 |

---

## Atlas inventory (v1 초안 — 모두 `reviewedBy` 없음)

좌표계: viewBox 240×300, 정면, 정중선 x=120. **보는 사람 기준 오른쪽(환자 왼쪽, x>120)** 에만 작성하고 정면 뷰에서는 좌우 대칭으로 복제한다. 랜드마크: 내안각 (136,126), 외안각 (176,124), 안와하연 y≈140, 비근 (120,122), 비첨 (120,176), 비익 (139,178), 구각 (148,212), 이부 (120,262), 하악각 근처 (196,232), 이주 (205,150).

| id | 이름 | 레이어 | 깊이 | 위험 | 부위 |
|---|---|---|---|---|---|
| supratrochlear-artery | 활차상동맥 | arteries | periosteum→smas→subcutaneous | critical | forehead-glabella |
| supraorbital-artery | 안와상동맥 | arteries | periosteum→smas→subcutaneous | high | forehead-glabella |
| dorsal-nasal-artery | 배측비동맥 | arteries | subcutaneous, smas | critical | nose |
| lateral-nasal-artery | 외측비동맥 | arteries | subcutaneous | critical | nose, nasolabial |
| angular-artery | 각동맥 | arteries | subcutaneous, smas | critical | nose, tear-trough, nasolabial |
| facial-artery | 안면동맥 | arteries | smas, subcutaneous | high | nasolabial, lips, chin-jawline, midface |
| superior-labial-artery | 상순동맥 | arteries | deep-fat | high | lips |
| inferior-labial-artery | 하순동맥 | arteries | deep-fat | high | lips |
| infraorbital-artery | 안와하동맥 | arteries | periosteum | high | tear-trough, midface |
| superficial-temporal-artery | 천측두동맥 전두가지 | arteries | smas | high | temple, forehead-glabella |
| deep-temporal-artery | 심측두동맥 | arteries | periosteum | high | temple |
| mental-artery | 이동맥 | arteries | periosteum | moderate | chin-jawline |
| angular-vein | 각정맥 | veins | subcutaneous, smas | moderate | tear-trough, nose |
| facial-vein | 안면정맥 | veins | smas, deep-fat | moderate | midface, nasolabial, chin-jawline |
| middle-temporal-vein | 중측두정맥 | veins | deep-fat | high | temple |
| supraorbital-nerve | 안와상신경 | nerves | periosteum→subcutaneous | moderate | forehead-glabella |
| infraorbital-nerve | 안와하신경 | nerves | periosteum | moderate | tear-trough, midface |
| mental-nerve | 이신경 | nerves | periosteum | moderate | chin-jawline |
| facial-nerve-temporal | 안면신경 측두분지 | nerves | smas | high | temple, forehead-glabella |
| facial-nerve-zygomatic | 안면신경 관골분지 | nerves | deep-fat | moderate | midface |
| marginal-mandibular-nerve | 하악연분지 | nerves | deep-fat | high | chin-jawline |
| parotid-duct | 이하선관 | ducts | deep-fat | moderate | midface |
| frontalis … masseter, temporalis (11개) | 근육 | muscles | smas | low~high(보톡스 확산 위험) | 각 부위 |
| temporal-fat-pad, soof, deep-medial-cheek-fat, nasolabial-fat, jowl-fat | 지방구획 | fat | 각 층 | low | 각 부위 |
| orbital-retaining-ligament, zygomatic-ligament, mandibular-ligament | 인대 | ligaments | periosteum 기시 | low~moderate | tear-trough, midface, chin-jawline |
| glabella-danger, nasal-danger, perialar-danger, tear-trough-danger, temporal-danger | 위험구역 | danger | — | critical/high | 해당 부위 |
| entry-* (forehead, temple, nose, tear-trough, midface, nasolabial, lips, chin-jawline, thread-temple) | 권장 진입점·벡터 | entry | 권장 평면 | low | 해당 부위, `entryFor`로 시술 제한 |

권장 평면(시술 × 부위, `regions.ts`의 `planes`): face-filler — 골막 위가 기본(이마·코·눈물고랑·턱), 팔자는 피하+심부, 입술은 피하(구륜근 표층), 관자는 골막 위(바늘) 또는 피하(캐뉼라). thread-lifting — 전 부위 피하. skin-booster — 진피(skin). collagen-stimulator — 관자·중안면·턱은 피하/골막 위, 팔자는 피하, 입술·코·눈물고랑은 "일반적으로 권장 부위 아님 — 제품 IFU 확인". filler-dissolving — 밴드 없음, "필러가 있는 층 — 초음파 확인 권장". botox — smas(근육).

---

### Task 1: 어휘와 아틀라스 무결성

**Files:**
- Create: `lib/bbip/anatomy/layers.ts`, `lib/bbip/anatomy/atlas.ts`, `lib/bbip/anatomy/regions.ts`
- Test: `tests/bbip-anatomy-atlas.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/bbip-anatomy-atlas.test.ts
import { describe, expect, it } from "vitest";
import { ATLAS, ATLAS_BY_ID, ATLAS_VIEWBOX, isReviewed } from "../lib/bbip/anatomy/atlas";
import { DEPTHS, LAYERS, PROCEDURE_CATEGORIES, RISKS } from "../lib/bbip/anatomy/layers";
import { REGIONS } from "../lib/bbip/anatomy/regions";

const depthKeys = new Set(DEPTHS.map((d) => d.key));
const layerKeys = new Set(LAYERS.map((l) => l.key));

function allPoints(s: (typeof ATLAS)[number]) {
  return (s.shapes.front ?? []).flatMap((shape) =>
    shape.kind === "point" ? [shape.at] : shape.kind === "vector" ? [shape.from, shape.to] : shape.pts
  );
}

describe("anatomy atlas integrity", () => {
  it("has unique kebab-case ids", () => {
    expect(new Set(ATLAS.map((s) => s.id)).size).toBe(ATLAS.length);
    for (const s of ATLAS) expect(s.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("gives every structure a depth, a risk, a layer and its texts", () => {
    for (const s of ATLAS) {
      expect(s.depths.length, s.id).toBeGreaterThan(0);
      for (const d of s.depths) expect(depthKeys.has(d), `${s.id} ${d}`).toBe(true);
      expect(Object.keys(RISKS)).toContain(s.risk);
      expect(layerKeys.has(s.layer), s.id).toBe(true);
      for (const text of [s.ko, s.en, s.course, s.riskNote, s.safeTechnique, s.depthNote, s.source]) {
        expect(text.trim().length, s.id).toBeGreaterThan(0);
      }
    }
  });

  it("draws every structure in the front view inside the viewBox", () => {
    for (const s of ATLAS) {
      const pts = allPoints(s);
      expect(pts.length, s.id).toBeGreaterThan(0);
      for (const [x, y] of pts) {
        expect(x >= 0 && x <= ATLAS_VIEWBOX.width && y >= 0 && y <= ATLAS_VIEWBOX.height, s.id).toBe(true);
      }
    }
  });

  it("limits entry points to known procedure categories", () => {
    for (const s of ATLAS.filter((x) => x.layer === "entry")) {
      expect(s.entryFor?.length, s.id).toBeGreaterThan(0);
      for (const c of s.entryFor ?? []) expect(PROCEDURE_CATEGORIES).toContain(c);
    }
  });

  it("ships as an unreviewed draft until the doctor signs off", () => {
    for (const s of ATLAS) {
      expect(isReviewed(s)).toBe(Boolean(s.reviewedBy && s.reviewedAt));
    }
  });
});

describe("regions", () => {
  it("covers the eight v1 regions", () => {
    expect(REGIONS.map((r) => r.key)).toEqual([
      "forehead-glabella", "temple", "nose", "tear-trough", "midface", "nasolabial", "lips", "chin-jawline",
    ]);
  });

  it("references only existing atlas ids", () => {
    for (const r of REGIONS) {
      expect(r.structureIds.length, r.key).toBeGreaterThan(0);
      for (const id of r.structureIds) expect(ATLAS_BY_ID.has(id), `${r.key} → ${id}`).toBe(true);
    }
  });

  it("puts every non-entry structure in at least one region", () => {
    const used = new Set(REGIONS.flatMap((r) => r.structureIds));
    for (const s of ATLAS) expect(used.has(s.id), s.id).toBe(true);
  });

  it("defines a plane for every procedure category with valid depths", () => {
    for (const r of REGIONS) {
      for (const c of PROCEDURE_CATEGORIES) {
        const plane = r.planes[c];
        expect(plane, `${r.key} ${c}`).toBeDefined();
        for (const d of plane.depths) expect(depthKeys.has(d)).toBe(true);
        expect(plane.note.length).toBeGreaterThan(0);
      }
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/bbip-anatomy-atlas.test.ts`
Expected: FAIL with `Cannot find module '../lib/bbip/anatomy/atlas'`

- [ ] **Step 3: Write `lib/bbip/anatomy/layers.ts`**

```ts
// Shared vocabulary for the BBIP anatomy map. Framework-free; colors are
// plain hex so both SVG and Tailwind-free contexts can use them.

export type ViewKey = "front" | "oblique" | "lateral";
export const VIEWS: { key: ViewKey; ko: string; en: string }[] = [
  { key: "front", ko: "정면", en: "Front" },
  { key: "oblique", ko: "45°", en: "Oblique" },
  { key: "lateral", ko: "측면", en: "Lateral" },
];

export type LayerKey =
  | "arteries" | "veins" | "nerves" | "ducts" | "muscles" | "fat" | "ligaments" | "danger" | "entry";

export interface LayerDef { key: LayerKey; ko: string; en: string; color: string }

export const LAYERS: LayerDef[] = [
  { key: "arteries", ko: "동맥", en: "Arteries", color: "#dc2626" },
  { key: "veins", ko: "정맥", en: "Veins", color: "#2563eb" },
  { key: "nerves", ko: "신경", en: "Nerves", color: "#ca8a04" },
  { key: "ducts", ko: "관", en: "Ducts", color: "#0d9488" },
  { key: "muscles", ko: "근육", en: "Muscles", color: "#be185d" },
  { key: "fat", ko: "지방구획", en: "Fat compartments", color: "#d97706" },
  { key: "ligaments", ko: "인대", en: "Ligaments", color: "#7c3aed" },
  { key: "danger", ko: "위험구역", en: "Danger zones", color: "#dc2626" },
  { key: "entry", ko: "진입점·벡터", en: "Entry points", color: "#059669" },
];

/** Superficial → deep. */
export type DepthKey = "skin" | "subcutaneous" | "smas" | "deep-fat" | "periosteum";
export const DEPTHS: { key: DepthKey; ko: string; en: string }[] = [
  { key: "skin", ko: "피부(진피)", en: "Skin / dermis" },
  { key: "subcutaneous", ko: "피하지방", en: "Subcutaneous fat" },
  { key: "smas", ko: "SMAS·근육", en: "SMAS / muscle" },
  { key: "deep-fat", ko: "심부지방·근하층", en: "Deep fat / sub-SMAS" },
  { key: "periosteum", ko: "골막", en: "Periosteum" },
];

export type RiskLevel = "critical" | "high" | "moderate" | "low";
export const RISKS: Record<RiskLevel, { ko: string; rank: number }> = {
  critical: { ko: "매우 높음", rank: 0 },
  high: { ko: "높음", rank: 1 },
  moderate: { ko: "중간", rank: 2 },
  low: { ko: "낮음", rank: 3 },
};

export type ProcedureCategory =
  | "face-filler" | "filler-dissolving" | "collagen-stimulator" | "thread-lifting" | "skin-booster" | "botox";
export const PROCEDURE_CATEGORIES: ProcedureCategory[] = [
  "face-filler", "filler-dissolving", "collagen-stimulator", "thread-lifting", "skin-booster", "botox",
];
export const CATEGORY_LABELS: Record<ProcedureCategory, string> = {
  "face-filler": "필러",
  "filler-dissolving": "필러 용해",
  "collagen-stimulator": "콜라겐 자극제",
  "thread-lifting": "실리프팅",
  "skin-booster": "스킨부스터",
  botox: "보톡스",
};
```

- [ ] **Step 4: Write `lib/bbip/anatomy/atlas.ts`** — `Pt`, `Shape`(line | area | point | vector), `AtlasStructure`(id, ko, en, layer, depths, depthNote, risk, riskNote, course, safeTechnique, keywords, shapes, entryFor?, source, reviewedBy?, reviewedAt?), `ATLAS_VIEWBOX`, `ATLAS`(위 인벤토리 전부, 정면 좌표), `ATLAS_BY_ID`, `getStructure`, `isReviewed`, `FACE_GUIDES`(정면 얼굴 윤곽·눈썹·눈·코·입술·귀). 출처 문자열은 `"BBIP 아틀라스 초안 — 표준 해부학 지식 기반, 원장 검토 필요"`.

- [ ] **Step 5: Write `lib/bbip/anatomy/regions.ts`** — `RegionKey`, `PlaneSpec { depths: DepthKey[]; note: string }`, `RegionDef { key, ko, en, keywords: RegExp, structureIds, area: Pt[], planes: Record<ProcedureCategory, PlaneSpec> }`, `REGIONS`(위 표), `getRegion`.

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run tests/bbip-anatomy-atlas.test.ts`
Expected: PASS

- [ ] **Step 7: Commit** — `feat(bbip): curated anatomy atlas, layers and regions`

---

### Task 2: 칩 → 시술 분류 → 부위 (`AnatomyPlan`)

**Files:**
- Modify: `lib/bbip/anatomy/regions.ts`
- Test: `tests/bbip-anatomy-regions.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/bbip-anatomy-regions.test.ts
import { describe, expect, it } from "vitest";
import { anatomyPlanFor, detectCategories, detectRegions, regionStructures } from "../lib/bbip/anatomy/regions";
import type { ParsedCase } from "../lib/bbip/types";

const chips = (procedures: string[], conditions: string[] = []): ParsedCase => ({
  patient: [], conditions, meds: [], procedures,
});

describe("detectCategories", () => {
  it("classifies injectable procedures", () => {
    expect(detectCategories(["팔자 필러"])).toEqual(["face-filler"]);
    expect(detectCategories(["필러 용해"])).toEqual(["filler-dissolving"]);
    expect(detectCategories(["쥬베룩 볼륨"])).toEqual(["collagen-stimulator"]);
    expect(detectCategories(["쥬베룩"])).toEqual(["skin-booster"]);
    expect(detectCategories(["엘란쎄", "스컬트라"])).toEqual(["collagen-stimulator"]);
    expect(detectCategories(["민트실 리프팅"])).toEqual(["thread-lifting"]);
    expect(detectCategories(["리쥬란 힐러"])).toEqual(["skin-booster"]);
    expect(detectCategories(["사각턱 보톡스"])).toEqual(["botox"]);
  });

  it("ignores non-injection procedures", () => {
    expect(detectCategories(["피코토닝", "울쎄라", "엑소좀 MTS", "스킨보톡스", "다한증 보톡스"])).toEqual([]);
  });
});

describe("detectRegions", () => {
  it("maps Korean region words without false hits", () => {
    expect(detectRegions(["눈밑 필러"])).toEqual(["tear-trough"]);
    expect(detectRegions(["팔자주름"])).toEqual(["nasolabial"]);
    expect(detectRegions(["코필러"])).toEqual(["nose"]);
    expect(detectRegions(["피코토닝", "코그실"])).toEqual([]);
    expect(detectRegions(["쥬베룩 볼륨"])).toEqual([]);
    expect(detectRegions(["앞광대", "볼꺼짐"])).toEqual(["midface"]);
    expect(detectRegions(["이마", "관자", "입술", "턱끝"])).toEqual([
      "forehead-glabella", "temple", "lips", "chin-jawline",
    ]);
  });
});

describe("anatomyPlanFor", () => {
  it("returns null when no procedure maps to the atlas", () => {
    expect(anatomyPlanFor(chips(["피코토닝"], ["기미"]))).toBeNull();
  });

  it("uses region words from procedures and conditions", () => {
    expect(anatomyPlanFor(chips(["필러"], ["팔자주름"]))).toEqual({
      categories: ["face-filler"], regions: ["nasolabial"], muscleOnly: false,
    });
  });

  it("falls back to category default regions", () => {
    expect(anatomyPlanFor(chips(["실리프팅"]))?.regions).toEqual(["midface", "chin-jawline", "temple"]);
    expect(anatomyPlanFor(chips(["필러"]))?.regions).toHaveLength(8);
  });

  it("shows only the muscle layer for botox-only cases", () => {
    const plan = anatomyPlanFor(chips(["사각턱 보톡스"]))!;
    expect(plan).toEqual({ categories: ["botox"], regions: ["chin-jawline"], muscleOnly: true });
    expect(regionStructures("chin-jawline", plan).every((s) => s.layer === "muscles")).toBe(true);
  });

  it("limits entry points to the case's categories", () => {
    const plan = anatomyPlanFor(chips(["실리프팅"], ["관자"]))!;
    const entries = regionStructures("temple", plan).filter((s) => s.layer === "entry");
    expect(entries.map((s) => s.id)).toEqual(["entry-thread-temple"]);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run tests/bbip-anatomy-regions.test.ts` → FAIL (`detectCategories` not exported)

- [ ] **Step 3: Implement in `regions.ts`**

```ts
export interface AnatomyPlan {
  categories: ProcedureCategory[];
  regions: RegionKey[];
  /** Botox only: the map shows the muscle layer and nothing else. */
  muscleOnly: boolean;
}

// Rule order matters: dissolving before filler, 쥬베룩 볼륨 before 쥬베룩.
const CATEGORY_RULES: [ProcedureCategory, RegExp][] = [
  ["filler-dissolving", /용해|히알루로니다[제아]|hyaluronidase|리도라제|하이레넥스/i],
  ["collagen-stimulator", /쥬베룩\s*볼륨|엘란쎄|스컬트라|래디어스|레디어스|radiesse|sculptra|ellans[eé]|plla|pdlla|caha|콜라겐\s*자극/i],
  ["thread-lifting", /실\s*리프팅|(민트|코그|녹는|pdo)\s*실|thread|잼버/i],
  ["skin-booster", /리쥬란|쥬베룩|스킨\s*부스터|부스터|물광|pdrn|프로파일로|profhilo|스킨바이브|skinvive/i],
  ["botox", /보톡스|톡신|보툴|botox|toxin|제오민|나보타|보툴렉스|코어톡스|디스포트|dysport/i],
  ["face-filler", /필러|filler|레스틸렌|쥬비덤|벨로테로|뉴라미스|이브아르|restylane|juvederm|belotero/i],
];
// Not injections into the mapped planes, so no anatomy card.
const EXCLUDE = /스킨\s*보톡스|더모\s*톡신|micro\s*botox|다한증|엑소좀|mts|더마펜|도포|바디\s*필러|엉덩이|가슴|손등/i;

export function detectCategories(procedures: string[]): ProcedureCategory[] {
  const found = new Set<ProcedureCategory>();
  for (const text of procedures) {
    if (EXCLUDE.test(text)) continue;
    const rule = CATEGORY_RULES.find(([, re]) => re.test(text));
    if (rule) found.add(rule[0]);
  }
  return PROCEDURE_CATEGORIES.filter((c) => found.has(c));
}

export function detectRegions(texts: string[]): RegionKey[] {
  return REGIONS.filter((r) => texts.some((t) => r.keywords.test(t))).map((r) => r.key);
}

const DEFAULT_REGIONS: Record<ProcedureCategory, RegionKey[]> = {
  "face-filler": REGION_KEYS,
  "filler-dissolving": REGION_KEYS,
  "collagen-stimulator": ["midface", "temple", "chin-jawline"],
  "thread-lifting": ["midface", "chin-jawline", "temple"],
  "skin-booster": ["midface", "tear-trough", "forehead-glabella"],
  botox: ["forehead-glabella"],
};

export function anatomyPlanFor(chips: ParsedCase): AnatomyPlan | null {
  const categories = detectCategories(chips.procedures);
  if (categories.length === 0) return null;
  let regions = detectRegions([...chips.procedures, ...chips.conditions]);
  if (regions.length === 0) {
    const defaults = new Set(categories.flatMap((c) => DEFAULT_REGIONS[c]));
    regions = REGION_KEYS.filter((k) => defaults.has(k));
  }
  return { categories, regions, muscleOnly: categories.every((c) => c === "botox") };
}

/** A region's structures for this case: muscles only for botox, entry points
 * only for the case's categories. */
export function regionStructures(key: RegionKey, plan: AnatomyPlan): AtlasStructure[] {
  return getRegion(key)
    .structureIds.map((id) => ATLAS_BY_ID.get(id)!)
    .filter((s) => (plan.muscleOnly ? s.layer === "muscles" : true))
    .filter((s) => s.layer !== "entry" || (s.entryFor ?? []).some((c) => plan.categories.includes(c)));
}
```

- [ ] **Step 4: Run** → PASS. **Step 5: Commit** — `feat(bbip): map procedure chips to anatomy regions`

---

### Task 3: 뷰 투영과 SVG path

**Files:**
- Create: `lib/bbip/anatomy/geometry.ts`
- Test: `tests/bbip-anatomy-geometry.test.ts`

모델: 정면 좌표 (x, y)를 높이 y에서 반폭 a(y)(정면 윤곽에서 보간)·깊이 b = 1.35a의 타원 단면 위 점으로 본다. θ = asin(u/a), u = x−120. 코·입술·턱은 돌출량 p(u, y)를 더한다. 뷰 회전 φ(정면 0°, 45°, 측면 90°, 얼굴이 보는 사람 왼쪽을 향함): `x' = cx + s·(a·sinθ·cosφ − (b·cosθ + p)·sinφ)`, `y' = top + s·(y − 0)`. `θ − φ < −90°`인 점(뒤로 돌아간 반대쪽)은 숨긴다. 뷰 실루엣은 같은 모델에서 y마다 θ를 샘플링한 최소/최대 x'로 만든다. 귀는 뷰별 수작업 가이드다.

- [ ] **Step 1: Write the failing test**

```ts
// tests/bbip-anatomy-geometry.test.ts
import { describe, expect, it } from "vitest";
import { mirrorShape, projectPoint, projectShape, smoothPath, viewOutline } from "../lib/bbip/anatomy/geometry";

describe("projectPoint", () => {
  it("is the identity in the front view", () => {
    expect(projectPoint([150, 200], "front")).toEqual([150, 200]);
  });

  it("moves the midline left and keeps lateral points visible in the oblique view", () => {
    const [mx] = projectPoint([120, 150], "oblique")!;
    const [lx] = projectPoint([200, 150], "oblique")!;
    expect(mx).toBeLessThan(lx);
    expect(mx).toBeLessThan(120);
  });

  it("puts the nose tip in front of the cheek in the lateral view", () => {
    const [tip] = projectPoint([120, 176], "lateral")!;
    const [cheek] = projectPoint([170, 176], "lateral")!;
    expect(tip).toBeLessThan(cheek);
  });

  it("hides far-side points that rotate behind the head", () => {
    expect(projectPoint([60, 150], "lateral")).toBeNull();
  });
});

describe("shapes and paths", () => {
  it("mirrors across the midline", () => {
    expect(mirrorShape({ kind: "point", at: [150, 10] })).toEqual({ kind: "point", at: [90, 10] });
  });

  it("drops a projected line with fewer than two visible points", () => {
    expect(projectShape({ kind: "line", pts: [[60, 150], [62, 160]] }, "lateral")).toBeNull();
  });

  it("builds a smooth SVG path", () => {
    expect(smoothPath([[0, 0], [10, 0]], false)).toBe("M0,0 L10,0");
    const d = smoothPath([[0, 0], [10, 10], [20, 0]], true);
    expect(d.startsWith("M0,0 C")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
  });

  it("produces a closed outline for every view", () => {
    for (const view of ["front", "oblique", "lateral"] as const) {
      expect(viewOutline(view).length).toBeGreaterThan(20);
    }
  });
});
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** `projectPoint(pt, view): Pt | null`, `projectShape(shape, view): Shape | null`, `mirrorShape(shape)`, `smoothPath(pts, closed)`(Catmull-Rom → cubic Bézier, 소수 1자리), `viewOutline(view): Pt[]`, `shapesFor(structure, view): Shape[]`(정면은 원본+대칭, 다른 뷰는 투영 원본+투영 대칭, `shapes[view]` 직접 지정 시 우선), `anchorOf(shapes): Pt | null`(툴팁 위치). **Step 4: Run** → PASS. **Step 5: Commit** — `feat(bbip): project the front atlas into oblique and lateral views`

---

### Task 4: `{{atlas:id}}` 토큰 + 프롬프트 블록

**Files:**
- Create: `lib/bbip/anatomy/tokens.ts`, `lib/bbip/anatomy/prompt.ts`
- Modify: `lib/bbip/evidence.ts`, `lib/bbip/prompts.ts`, `lib/bbip/context.ts`, `lib/bbip/generate.ts`
- Test: `tests/bbip-anatomy-tokens.test.ts`, `tests/bbip-context.test.ts`(케이스 추가)

- [ ] **Step 1: Write the failing tests**

```ts
// tests/bbip-anatomy-tokens.test.ts
import { describe, expect, it } from "vitest";
import { atlasTokenIds, atlasTokensToText } from "../lib/bbip/anatomy/tokens";
import { buildAtlasBlock } from "../lib/bbip/anatomy/prompt";
import { anatomyPlanFor } from "../lib/bbip/anatomy/regions";
import { renderEvidenceHtml, toPlainNoteText } from "../lib/bbip/evidence";
import { fakeTurnText } from "../lib/bbip/generate";

describe("atlas tokens", () => {
  it("renders known ids as focusable chips", () => {
    const html = renderEvidenceHtml("{{atlas:angular-artery}} 주의 [AI]", []);
    expect(html).toContain('<button type="button" class="ev ev-atlas" data-atlas="angular-artery"');
    expect(html).toContain("각동맥");
  });

  it("drops unknown ids to plain text", () => {
    const html = renderEvidenceHtml("{{atlas:made-up-artery}} 근처", []);
    expect(html).not.toContain("ev-atlas");
    expect(html).toContain("made-up-artery");
    expect(html).not.toContain("{{");
  });

  it("leaves tokens inside code untouched", () => {
    expect(renderEvidenceHtml("`{{atlas:angular-artery}}`", [])).not.toContain("ev-atlas");
  });

  it("lists known ids and spells tokens out for notes", () => {
    expect(atlasTokenIds("{{atlas:facial-artery}} {{atlas:nope}} {{atlas:facial-artery}}")).toEqual(["facial-artery"]);
    expect(atlasTokensToText("{{atlas:facial-artery}} 주행")).toBe("안면동맥(facial a.) 주행");
    expect(toPlainNoteText("{{atlas:facial-artery}} 주의 [AI]")).toBe("안면동맥(facial a.) 주의 (AI 보충)");
  });
});

describe("atlas prompt block", () => {
  it("is empty without a plan", () => {
    expect(buildAtlasBlock(null)).toBe("");
  });

  it("lists region structures by id, name, depth and risk only", () => {
    const block = buildAtlasBlock(anatomyPlanFor({ patient: [], conditions: ["팔자"], meds: [], procedures: ["필러"] }));
    expect(block.startsWith("<atlas>")).toBe(true);
    expect(block).toContain("facial-artery");
    expect(block).toContain("{{atlas:id}}");
    expect(block).not.toMatch(/\(\d+,\d+\)/);
  });
});

describe("fake brief", () => {
  it("mentions an atlas structure when the case maps to the atlas", () => {
    const text = fakeTurnText({
      session: {
        id: "s", chips: { patient: [], conditions: [], meds: [], procedures: ["팔자 필러"] },
        flags: [], sourceNoteIds: [], promptVersion: "bbip-v1", createdAt: "",
      },
      entries: [], priorTurns: [], request: { kind: "brief" },
    });
    expect(text).toMatch(/\{\{atlas:[a-z-]+\}\}/);
  });
});
```

`tests/bbip-context.test.ts`에 추가:

```ts
it("puts the atlas block in the cached session prefix", () => {
  const filler: BbipSession = { ...session, chips: { ...session.chips, procedures: ["팔자 필러"] } };
  const a = buildTurnContext({ session: filler, entries, priorTurns: [], request: { kind: "brief" } });
  const b = buildTurnContext({ session: filler, entries, priorTurns: [], request: { kind: "section", sectionKey: "ddx" } });
  const stableA = textOf(a.messages[0]!.content[0]);
  expect(stableA).toContain("<atlas>");
  expect(stableA).toBe(textOf(b.messages[0]!.content[0]));
});
```

- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement**
  - `tokens.ts`: `ATLAS_TOKEN = /\{\{atlas:([a-z0-9-]{1,60})\}\}/g`, `atlasTokenIds`, `atlasTokensToText`(`${ko}(${en})`, 모르는 id는 id 그대로), `atlasChipHtml(id)`(모르는 id → 이스케이프된 id 텍스트).
  - `evidence.ts`: 두 번째 인라인 확장 `atlas`(`start: src.indexOf("{{atlas:")`), `toPlainNoteText` 첫 단계에서 `atlasTokensToText`.
  - `prompts.ts`: `neutralizeTags` 정규식에 `atlas` 추가.
  - `prompt.ts`: `buildAtlasBlock(plan)` — 부위 이름, 구조물 `id · ko en · 위험 · 깊이 · riskNote`, 규칙(“구조물은 {{atlas:id}}로만 언급, 목록 밖 구조물의 위치·주행·깊이는 지어내지 말고 '아틀라스에 없음 — 확인 필요'”).
  - `context.ts`: `stable`에 `buildAtlasBlock(anatomyPlanFor(session.chips))`를 노트 블록 뒤에 붙인다(비어 있으면 생략).
  - `generate.ts`: fake 브리핑에 `- 주의 구조물: {{atlas:<첫 critical/high 동맥>}} [AI]` 한 줄.
- [ ] **Step 4: Run** `npx vitest run tests/bbip-anatomy-tokens.test.ts tests/bbip-context.test.ts tests/bbip-evidence.test.ts tests/bbip-generate.test.ts` → PASS
- [ ] **Step 5: Commit** — `feat(bbip): atlas tokens in prompts and rendered chips`

---

### Task 5: 내 자료 그림 API

**Files:**
- Create: `lib/bbip/anatomy/figures.ts`, `lib/bbip/anatomy/figureQuery.ts`, `app/api/bbip/sessions/[id]/figures/route.ts`
- Test: `tests/bbip-anatomy-figures.test.ts`

- [ ] **Step 1: Write the failing test** — 순수 점수(`anatomyFigureScore("Angular artery course along the nasojugal groove", ["tear-trough"]) > 0`, `"문서 내장 이미지 (a.png)"` → 0, 부위 일치가 일반 해부어보다 앞) + API(임시 DB에 노트 1개 + figure 2개 삽입 → 세션 생성 → GET이 해부 캡션 figure만, `entryTitle` 포함 반환; 없는 세션 404).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** — `ANATOMY_WORDS` 정규식(동맥·정맥·신경·혈관·해부·인대·지방·근육·근막·골막·층·위험·주입·캐뉼라·foramen·artery·vein·nerve·anatom·ligament·fat pad·muscle·fascia·smas·periost·plane·layer·danger·cannula), 점수 = 2×부위 키워드 + 1×해부어; `pickAnatomyFigures(rows, regions, limit=12)` 점수순. `listSessionFigures(sessionId)`는 `figures.entryId ∈ session.sourceNoteIds`를 entries와 조인. 라우트는 `{ figures: AnatomyFigure[] }`.
- [ ] **Step 4: Run** → PASS. **Step 5: Commit** — `feat(bbip): anatomy figures from session notes`

---

### Task 6: 해부 지도 UI

**Files:**
- Create: `components/bbip/anatomy/{AnatomyCard,FaceMap,DepthCrossSection,StructureTable,MyFigures,ReviewBadge}.tsx`
- Modify: `components/bbip/BbipConsole.tsx`, `components/bbip/TurnCard.tsx`, `components/bbip/EvidenceMarkdown.tsx`, `app/globals.css`

- [ ] **Step 1: `ReviewBadge`** — `reviewed ? null : <span …>원장 검토 전 초안</span>`(amber, mono 10px).
- [ ] **Step 2: `FaceMap`** — props `{ plan, region, structures, focusId, onFocus }`. 뷰 탭(`role="tablist"`, ←/→ 키), 레이어 토글(`aria-pressed` 버튼; botox만이면 근육 외 비활성), SVG(`role="group"`, `<title>`), 얼굴 실루엣·가이드, 부위 영역(점선), 각 구조물 `<g role="button" tabIndex={0} aria-label="각동맥 angular a. · 위험 매우 높음" aria-pressed>` + `<title>`, 부위 밖 구조물은 흐리게(opacity .18), 위험구역은 빗금 패턴, 진입점은 화살표 마커. 호버·포커스·탭 → 툴팁 카드(이름 한/영, 주행, 깊이, 위험, 안전 술기, 검토 배지; Esc로 닫기). 같은 내용 `aria-live="polite"`.
- [ ] **Step 3: `DepthCrossSection`** — 5층 세로 스택 SVG, 구조물을 열로 배치해 각 깊이층에 점/선, 선택한 시술의 권장 평면을 초록 밴드 + 라벨, 밴드가 없으면 `plane.note`.
- [ ] **Step 4: `StructureTable`** — 열: 구조물 | 위치 | 깊이 | 위험 | 안전 술기 | 근거. 위험 rank 순(동률은 아틀라스 순서), 진입점 제외. 근거: 아틀라스 초안 + 검토 배지, 세션 노트 제목이 `keywords`와 맞으면 📚n 링크. 행 클릭/Enter → 지도 포커스.
- [ ] **Step 5: `MyFigures`** — `GET /api/bbip/sessions/:id/figures`, 썸네일 그리드(`/api/figures/:id`, `alt`=캡션), 클릭 → `<dialog>` 확대 + "원 노트 열기" 링크. 0건이면 섹션 숨김.
- [ ] **Step 6: `AnatomyCard`** — `anatomyPlanFor(chips)`가 null이면 렌더하지 않음. 헤더(Compass 아이콘, "Anatomy map" 킥커, "해부 지도", 검토 전 구조물 수 배지, 도식 고지), 부위 칩, 시술 탭(2개 이상일 때), FaceMap + DepthCrossSection 그리드, StructureTable, MyFigures. 외부 `focusId`가 바뀌면 그 구조물이 있는 부위로 전환하고 카드로 스크롤.
- [ ] **Step 7: 콘솔 연결** — `BbipConsole`에 `atlasFocus` 상태, 브리핑 섹션 바로 아래 `<section aria-labelledby="bbip-anatomy">`(SectionHeading index "02", kicker "Anatomy map"; MoreMenu는 "03", 열어 본 카드는 "04"로 번호 이동). `EvidenceMarkdown`에 `onAtlas` 클릭 위임(`closest("[data-atlas]")`), `TurnCard`가 전달. CSS `.ev-atlas`(sky 톤 칩, 버튼 리셋).
- [ ] **Step 8: Run** `npm run typecheck && npm test` → PASS. **Step 9: Commit** — `feat(bbip): anatomy map card — face map, depth section, structure table, my figures`

---

### Task 7: E2E

**Files:**
- Create: `tests/e2e/bbip-anatomy.e2e.ts`

- [ ] **Step 1: Write the test**

```ts
// tests/e2e/bbip-anatomy.e2e.ts
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.setTimeout(60_000);
const COLD = { timeout: 20_000 };

test("filler case shows the anatomy map instantly and atlas chips focus structures", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("케이스 입력").fill("50대 여성, 팔자주름, 팔자 필러 희망");
  await page.getByRole("button", { name: "BBIP", exact: true }).click();

  const card = page.locator("section[aria-labelledby='bbip-anatomy']");
  await expect(card.getByRole("heading", { name: /해부 지도/ })).toBeVisible(COLD);
  await expect(card.getByRole("tab", { name: "정면" })).toHaveAttribute("aria-selected", "true");
  await expect(card.getByRole("cell", { name: /안면동맥/ }).first()).toBeVisible();
  await expect(card.getByText("원장 검토 전 초안").first()).toBeVisible();

  await card.getByRole("tab", { name: "측면" }).click();
  await expect(card.getByRole("tab", { name: "측면" })).toHaveAttribute("aria-selected", "true");

  await expect(page.getByText("[FAKE 모드]")).toBeVisible(COLD);
  const chip = page.locator("button.ev-atlas").first();
  const id = await chip.getAttribute("data-atlas");
  await chip.click();
  await expect(card.locator(`[data-structure='${id}'][aria-pressed='true']`)).toBeVisible();

  const results = await new AxeBuilder({ page }).include("section[aria-labelledby='bbip-anatomy']").analyze();
  expect(results.violations).toEqual([]);
});

test("non-injection case has no anatomy map", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("케이스 입력").fill("40대 여성, 기미, 피코토닝 희망");
  await page.getByRole("button", { name: "BBIP", exact: true }).click();
  await expect(page.getByText("[FAKE 모드]")).toBeVisible(COLD);
  await expect(page.locator("section[aria-labelledby='bbip-anatomy']")).toHaveCount(0);
});
```

- [ ] **Step 2: Run** `npm run test:e2e` → PASS (기존 6개 + 2개)
- [ ] **Step 3: Commit** — `test(bbip): anatomy map end-to-end`

---

### Task 8: 마무리 검증

- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `npm run test:e2e`
- [ ] 브라우저에서 세 뷰를 눈으로 확인(구조물이 얼굴 밖으로 나가지 않는지, 측면 코 돌출, 45° 대칭 복제), 스크린샷 첨부
- [ ] README BBIP 섹션에 "🧭 해부 지도 — 아틀라스 검토 방법(`reviewedBy/reviewedAt` 기입)" 한 단락
- [ ] Commit — `docs(bbip): anatomy atlas review workflow`
