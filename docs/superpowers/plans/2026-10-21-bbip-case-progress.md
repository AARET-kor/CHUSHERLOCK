# BBIP Plan 6 — 경과 그래프 · 사진 비교 · AI 변화 분석 Implementation Plan

> **For agentic workers:** executed inline in the planning session (executing-plans), test-first per task, one commit per task.

**Goal:** The course page shows how a course is going. It has three parts:
- **Progress chart:** GAIS (doctor and patient) and the indication score across visits.
- **Photo comparison:** two visits at the same angle, side by side or with a slider.
- **AI change analysis:** on request. After a confirm step, the two photos and the course's clinical facts go to Claude. The answer is stored on the later visit as an AI draft, and the doctor can merge it into the note.

**Spec:** `docs/superpowers/specs/2026-10-21-bbip-case-records-design.md` §7. Builds on Plan 5 (`docs/superpowers/plans/2026-10-21-bbip-case-records.md`) and the automatic visit result.

**Decisions locked here:**
- **Charts follow the dataviz method.**
  - Two small charts, never a dual axis: **GAIS** (doctor = slot 1 blue `#2a78d6`, patient = slot 2 orange `#eb6834`; validated in light mode, all checks pass) and **indication score** (one series, blue, titled by the score name, no legend).
  - Marks: 2 px lines, 8 px markers, a crosshair that snaps to the nearest visit, and one tooltip listing every series.
  - Each x position is a keyboard-focusable hit target, and a "Table view · 표로 보기" disclosure carries every value.
  - Axes point "better" upward: GAIS 1 (Exceptional) is at the top. A lower-is-better score (mMASI, WSRS) is drawn inverted and the axis says so ("↑ 좋아짐").
  - The app has no dark mode, so light mode only.
- **X = visits that carry at least one value,** equally spaced and labelled `Baseline`, `S5`, `F/U`. A chart is hidden when it has no values.
- **Compare defaults:**
  - From = the first visit with photos, To = the last visit with photos, Angle = the first angle both visits have.
  - Only angles both visits have are offered.
  - The slider is a native range input (labelled) over two stacked full-size images. The top image is clipped with `clip-path: inset(...)`.
- **AI change analysis:**
  - Model `BBIP_COMPARE_MODEL ?? CODEX_AI_MODEL_MID` (Sonnet 5.5, per the approved spec) with the server-side refusal fallback (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`) and effort `medium`.
  - Images are re-encoded to a long edge of ≤ 1024 px as JPEG base64.
  - The text contains clinical facts only: procedure, indication, the two visits' dates, kinds and sessions, sessions in between, product and parameters, GAIS and score. No chart number, alias, features, memo, visit notes or consult results.
  - The confirm panel shows exactly that text plus the two thumbnails before anything is sent.
  - Fake mode returns a fixed draft.
- **Storage:** `visits.ai_analysis` (JSON `{ text, model, fromVisitId, angle, createdAt }`, migration `0016`) on the later visit. "Add to note · 메모에 합치기" appends `[AI 변화 분석 초안] …` to the visit note.

## Tasks

| # | Task | Files | Tests |
|---|---|---|---|
| 1 | Progress rows, compare pair, shared angles, visit labels (pure) | `lib/records/progress.ts` | `tests/records-progress.test.ts` |
| 2 | Progress chart component (SVG, crosshair, tooltip, focus, table view) + course page section | `components/records/ProgressChart.tsx`, `components/records/CoursePage.tsx` | E2E |
| 3 | Compare view (selects, angle chips, side-by-side / slider) + course page section | `components/records/CompareView.tsx`, `CoursePage.tsx` | E2E |
| 4 | `visits.ai_analysis` column + types + service passthrough | `lib/db/schema.ts`, `drizzle/0016_*`, `lib/records/types.ts`, `lib/services/recordsService.ts` | `tests/records-service.test.ts` |
| 5 | Clinical facts (pure, client-safe) and the AI call (server): params, downscale, caller, fake text, errors | `lib/records/compareFacts.ts`, `lib/records/compareAi.ts` | `tests/records-compare.test.ts` |
| 6 | `POST /api/records/compare` and `POST /api/records/visits/[id]/merge-analysis` | `app/api/records/compare/route.ts`, `app/api/records/visits/[id]/merge-analysis/route.ts` | `tests/records-compare.test.ts` |
| 7 | Confirm panel, result display in compare view and visit rows, merge-to-note | `CompareView.tsx`, `CoursePage.tsx` | E2E |
| 8 | E2E (chart, compare, slider, fake AI analysis, merge), full verification, apply to 3200 | `tests/e2e/bbip-records.e2e.ts` | full suite |
