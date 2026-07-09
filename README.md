# New Codex

A personal + clinic knowledge base for aesthetic medicine. You feed it raw
material — device parameters, papers, textbook chapters, personal know-how —
and it files each piece under a category and a content tier, keeps the
citation, links it to related existing notes instead of duplicating them, and
exports everything as an Obsidian-ready vault.

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
- **Overlap instead of collision.** New material in the same category as an
  existing entry gets auto-linked (`lib/codex/overlap.ts`, a title-token
  Jaccard heuristic today) instead of silently duplicating or fighting the
  old note. The related-notes section becomes Obsidian wikilinks on export.
- **Markdown export over live sync.** Obsidian integration ships as a
  "download a vault-shaped .zip / .md" flow (`/api/export/all`,
  `/api/entries/[id]/export`) rather than a live Obsidian REST API
  connection. Drop the export into (or on top of) your vault folder and
  Obsidian picks it up — no plugin or running Obsidian instance required on
  the server side.

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
   or plain text/markdown → one raw text string.
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
   The system prompt is static so prompt caching keeps per-chunk cost down.
4. **Review** (`/ingest`) — suggestions render as editable cards (title,
   category, tier, content, tags, source location). Saving goes through the
   same `entryService.createEntry` as manual entry, so overlap
   auto-linking and the mandatory-source rule apply unchanged.

Jobs run in the background (`ingest_jobs` table) and the UI polls progress —
a large document takes minutes and that's expected.

Environment:

```bash
ANTHROPIC_API_KEY=sk-ant-...   # or `ant auth login`
CODEX_AI_MODEL=claude-opus-4-8 # optional override
CODEX_AI_MODE=fake             # optional: offline deterministic mode (no API calls)
```

## Getting started

```bash
npm install
cp .env.example .env
npm run db:generate   # only needed after changing lib/db/schema.ts
npm run db:migrate     # creates ./data/codex.sqlite and seeds the taxonomy
npm run dev
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
- **Semantic overlap detection.** Overlap linking still uses the
  title-token heuristic in `lib/codex/overlap.ts`; upgrading it to
  embedding/model-based similarity is a natural follow-up now that the
  ingest pipeline exists.

## Commands

```bash
npm run dev         # local dev server
npm run build        # production build
npm run typecheck     # tsc --noEmit
npm run test           # vitest
npm run db:generate     # regenerate drizzle/ migration SQL after schema changes
npm run db:migrate       # apply migrations + reseed taxonomy
```
