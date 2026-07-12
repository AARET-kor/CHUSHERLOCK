# Cognitio

A personal + clinic knowledge base for aesthetic medicine. You feed it raw
material — device parameters, papers, textbook chapters, personal know-how —
and it files each piece under a category and a content tier, keeps the
citation, and links it to related existing notes instead of duplicating
them. The app itself is the library — search, decorate, share; export to
Word/Markdown when something needs to leave.

Material can be entered by hand (`/entries/new`) or run through the **AI
ingest pipeline** (`/ingest`): upload a PDF/DOCX/text file or paste raw text,
and Claude reads it front-to-back — chunk by chunk, carrying a rolling
context summary so classification decisions see the document's overall flow
and 목차, not just local text — then proposes one note per topic with
category, tier, tags, and source location. You review/edit each suggestion
before it's saved; nothing enters the knowledge base unreviewed.

This is a **separate project** from `TIKIDOC_platform` (the clinic
booking/consultation-prep app) — no code or infra is shared.

## Why these choices

- **Bilingual by default.** The content field is one free-form body where
  Korean and English can be mixed sentence-by-sentence. Nothing is forced
  into parallel translation blocks, and nothing is auto-summarized — the
  product requirement was explicit: don't over-compress, optimize for
  readability.
- **Four content tiers**, because "how you'd file a parameter" is different
  from "what you'd study" or "what you'd say to the patient." See
  `lib/codex/tiers.ts`:
  - `procedure_tip` — 시술 팁: parameters, usage, simple principles.
  - `chairside_talk` — 시술 중 설명 멘트: what to say to the patient.
  - `deep_study` — 심화 학습: paper-level depth.
  - `base_medical_knowledge` — 베이스 의학지식: the anatomy/physiology
    everything else assumes.
- **Overlap instead of collision.** New material gets auto-linked to
  existing notes on the same topic instead of silently duplicating them.
  Two passes at save time: a fast title-similarity heuristic
  (`lib/codex/overlap.ts` — also powers the instant in-form warning) plus a
  **semantic pass** (`lib/ai/relatedness.ts`) where Claude judges
  same-category notes for genuine topic overlap. The semantic pass never
  blocks a save — if the model is unavailable it degrades to the heuristic.
- **The app IS the library — no Obsidian required.** Cognitio stopped
  treating Obsidian as the destination: you read, search, decorate, and
  share notes here. Exports are for the real-world cases instead:
  - **전체 백업** (`/api/export/all`) — every note as plain Markdown in a
    category-foldered .zip. Future-proof, opens in any editor (and yes,
    still drops cleanly into an Obsidian vault if you use one).
  - **Word/HTML per note** — for handing a protocol to staff or colleagues
    who live in Word; images embedded so nothing breaks.
  - **.cognote 공유** — lossless note exchange between Cognitio users.

## Stack

Next.js (App Router) + TypeScript, Drizzle ORM over a local SQLite file,
Zod for input validation, Tailwind for styling, Vitest for tests, and the
Anthropic SDK (`@anthropic-ai/sdk`) for classification. SQLite is
a deliberate choice for this personal-use phase — zero infra to run it
locally. Swapping the Drizzle SQLite dialect for Postgres later (e.g. if this
becomes multi-clinic/hosted) is a schema-adapter change, not a rewrite —
keep the same `lib/codex/*` domain layer either way.

## How the AI ingest pipeline works

The design goal is the product brief's hardest requirement: **don't
over-summarize** — read the document's flow, then reorganize by 목차 and
쓰임 (usage) while preserving parameters, doses, and step sequences.

1. **Extract** (`lib/ingest/extract.ts`) — PDF (pdf-parse), DOCX (mammoth),
   or plain text/markdown → one raw text string. **Scanned PDFs** (no text
   layer, detected by chars-per-page) and **photos of pages** (JPG/PNG/WEBP)
   fall back to Claude vision OCR (`lib/ingest/ocr.ts`) — large PDFs are
   split into 15-page segments with pdf-lib and transcribed verbatim,
   preserving tables and structure as Markdown.
2. **Chunk** (`lib/ingest/chunk.ts`) — split at natural boundaries
   (headings first, then paragraphs, then sentences), max ~24k chars,
   strictly in document order.
3. **Sequential read** (`lib/ai/classify.ts`) — each chunk goes to Claude
   (`claude-opus-4-8` by default, adaptive thinking, structured JSON output
   whose `categoryKey` enum is generated from the live taxonomy so invalid
   categories are impossible). The model returns the notes found in that
   chunk **plus an updated rolling summary of the document so far**, which
   is fed into the next chunk's prompt — that's how a 300-page textbook gets
   read as one coherent document instead of 40 disconnected fragments.
   Every note opens with an easy 3-4 line "한눈에 보기" summary, then the
   source-faithful body.
4. **Token efficiency** — the pipeline is tuned to keep API cost per
   document low:
   - **Two-model split**: the main model (`CODEX_AI_MODEL`, default
     `claude-opus-4-8`) only does the part where quality matters — reading
     chunks and writing notes. Mechanical subtasks (verbatim OCR
     transcription, relatedness screening) run on `CODEX_AI_MODEL_LIGHT`
     (default `claude-haiku-4-5`, ~1/5 the per-token price, no thinking
     tokens).
   - **Prompt caching at two breakpoints**: the static system prompt
     (taxonomy + note-writing rules) and the job-stable prefix (document
     metadata + figure list) each carry a `cache_control` marker, so chunks
     2..N read both from cache (~0.1× input price) instead of re-paying.
   - **Bounded rolling context**: the cross-chunk summary is hard-capped,
     and relatedness candidates are trimmed (24 notes × 240-char excerpts),
     so prompts can't grow unboundedly on large libraries.
5. **Review** (`/ingest`) — suggestions render as editable cards (title,
   category, tier, content, tags, source location). Saving goes through the
   same `entryService.createEntry` as manual entry, so overlap
   auto-linking and the mandatory-source rule apply unchanged.

Jobs run in the background (`ingest_jobs` table) and the UI polls progress —
a large document takes minutes and that's expected.

Environment:

```bash
ANTHROPIC_API_KEY=sk-ant-...   # or `ant auth login`
CODEX_AI_MODEL=claude-opus-4-8       # main model (notes) — optional override
CODEX_AI_MODEL_LIGHT=claude-haiku-4-5 # light model (OCR/relatedness) — optional
CODEX_AI_MODE=fake                    # optional: offline deterministic mode (no API calls)
```

## 노트 꾸미기 & 공유

- **형광펜/볼펜.** Note bodies support a decoration syntax on top of
  Markdown: `==yellow:텍스트==` (highlight, 5 colors) and `++red:텍스트++`
  (pen color, 5 colors) — see `lib/codex/decorations.ts`. The edit form has
  a toolbar (`components/EditorToolbar.tsx`): select text, click a color, or
  insert symbols (✓ ± ≥ ℃ ⚠️ 💉 …) from the Ω palette, with a live 미리보기
  toggle. In the app, highlights paint themselves in left-to-right when a
  note opens; in Word/HTML/Obsidian exports the colors travel as inline
  styles, so nothing breaks outside the app.
- **.cognote 공유.** Select notes in the library and press **공유** to
  download a `.cognote` file — a single self-contained JSON where every
  cropped figure is embedded as base64 alongside the note's Markdown,
  decorations included. Anyone running Cognitio imports it via **가져오기**
  (library header): figures are written under fresh ids, image links inside
  the content are rewritten to match, and a note filed under a category the
  receiver doesn't have falls back to a sensible default instead of failing.
  Endpoints: `GET /api/share/export?ids=…`, `POST /api/share/import`.

## Getting started (로컬 실행)

필요한 것: [Node.js 20+](https://nodejs.org) 와 Anthropic API 키
([platform.claude.com](https://platform.claude.com) → API Keys → Create Key —
키 전체 값은 생성 순간에만 보이므로 바로 복사해 두세요).

```bash
git clone https://github.com/AARET-kor/CHUSHERLOCK.git cognitio
cd cognitio
npm install
cp .env.example .env        # Windows: copy .env.example .env
# .env 파일을 열어 ANTHROPIC_API_KEY=sk-ant-... 를 입력
npm run db:migrate           # ./data/codex.sqlite 생성 + 분류체계 시드
npm run dev
```

브라우저에서 `http://localhost:3000` 을 열면 됩니다.

- **자료 넣기 (AI)** — PDF/DOCX/텍스트/사진을 올리면 AI가 읽고 분류 제안.
- **직접 추가** — 수동 입력.
- 키 없이 UI만 먼저 보려면: `.env`에 `CODEX_AI_MODE=fake` 를 넣고 실행
  (API 호출 없이 가짜 제안으로 전체 흐름 체험).

데이터는 전부 로컬 `./data/codex.sqlite` 파일에 저장됩니다.

```bash
npm run db:generate   # only needed after changing lib/db/schema.ts
```

Then open `http://localhost:3000`:

- `/` — dashboard of everything you've filed, plus a "전체 Obsidian export
  (.zip)" button.
- `/entries/new` — add material. Title/category blur triggers an overlap
  check so you see related existing notes before you save.
- `/entries/[id]` — full entry view, single-file `.md` export, and a raw
  Markdown preview of exactly what gets exported.
- `/categories` — the current taxonomy tree.

## Project layout

```txt
app/                      Next.js routes (dashboard, entry CRUD UI, exports)
components/                EntryForm, EntryCard, TierBadge, CategoryBadge
lib/
  codex/
    types.ts               Core domain types (Entry, Category, Tier, Source)
    taxonomy.ts             Seed category tree (from the procedure/complication/
                             anatomy/dermatology/patient-comms/safety checklist)
    tiers.ts                The four content tiers
    overlap.ts               Title-similarity overlap detection (pre-AI heuristic)
    markdown-export.ts       Entry -> Obsidian Markdown file (frontmatter + body)
  db/
    schema.ts               Drizzle tables (categories, entries, sources, relations)
    client.ts                SQLite connection
    migrate.ts                Runs migrations + seeds taxonomy
  schemas/
    entrySchemas.ts          Zod input validation
  services/
    entryService.ts          DB-backed CRUD + overlap-aware create
  actions/
    entryActions.ts          Server actions used by client components (overlap
                              preview, delete)
  ai/
    classify.ts               NOT IMPLEMENTED — documented extension point for
                              LLM-backed auto classification (see file header)
tests/                       Vitest: taxonomy, entrySchemas, overlap, markdown-export
```

## Taxonomy

Seeded in `lib/codex/taxonomy.ts` from the study checklist in the product
brief: procedure technique (botox/filler/skin-booster/rejuran/juvelook/laser
toning/IPL/pico/CO2/HIFU/RF), complications (vascular occlusion, necrosis,
infection, granuloma, HSV reactivation, PIH, burn), anatomy (facial/angular/
supratrochlear-supraorbital artery, infraorbital foramen, temporal danger
zone), dermatology basics (melasma, acne, rosacea, scar, enlarged pore,
photoaging), patient communication, safety screening (anticoagulants,
pregnancy, autoimmune disease), Fitzpatrick skin type, and before/after
marketing-asset standardization. Add new leaf categories directly in that
file — entries only ever file under a leaf (see `getLeafCategories()`).

## What's intentionally not built yet

- **Live Obsidian sync** (Local REST API plugin). Export is file-based for
  now; a live-push mode can be added later without touching the domain
  layer.
- **Auth / multi-user.** Single-user local tool for now — "원장들용" (multi-
  clinic) access control is a later phase once the classification flow is
  validated.
- **Semantic overlap in the in-form preview.** The instant warning while
  typing still uses the title heuristic (it must be sub-second); the
  model-based semantic pass runs at save time.

## Commands

```bash
npm run dev         # local dev server
npm run build        # production build
npm run typecheck     # tsc --noEmit
npm run test           # vitest
npm run db:generate     # regenerate drizzle/ migration SQL after schema changes
npm run db:migrate       # apply migrations + reseed taxonomy
```
