# BBIP — 미용 GP 진료 비서 설계

- 작성일: 2026-10-18
- 브랜치: `bbip`
- 상태: 설계 확정, 구현 계획 전

## 1. 목표

상담·시술 중에 환자의 특징, 질환·복용약, 희망 시술을 한 줄로 입력하면 다음 순서로 보여준다.

1. 지금 알아야 할 **핵심 브리핑**을 곧바로 띄운다.
2. 그다음 의사가 **골라서 파고든다**: 감별질환, 부작용·대처법, 업셀링, 문헌 근거 등.
3. 주사·캐뉼라 시술(필러, 실리프팅, 쥬베룩 볼륨 등)은 **해부 구조와 위험 구조물**을 그림, 단면도, 표로 한눈에 보여준다.

BBIP는 Cognitio를 리브랜딩한 앱이다. 기존 지식베이스(노트 203개, 인제스트, 검색, 학습/복습)는 그대로 남아 BBIP가 근거로 쓰는 "지식 창고" 역할을 한다.

### 하지 않는 것 (v1)

- 환자 차트·EMR 기능. 환자 식별정보는 저장하지 않는다.
- 진짜 3D 두상 모델(three.js 등). 라이선스 있는 3D 에셋이 필요하므로 v2로 미룬다(§11).
- 교과서 원문을 외부에서 실시간으로 가져오는 기능. 저작권 때문에 교과서는 사용자가 인제스트한 자료만 쓴다.
- 다중 사용자 / 다중 의원.

## 2. 사용자 흐름

```
[ 40대 여 기미, 아스피린 복용, 피코토닝 희망              ⏎ ]
 👤40대·여  🩺기미  💊아스피린  💉피코토닝     (칩 ✕로 수정 → 재생성)

 🚨 항혈소판제 복용 — 멍·점상출혈 위험 ↑ (금기 아님, 설명 필수)

┌─ ⚡ 핵심 브리핑 ────────────────────────────────┐
│ 5~7줄 · 각 줄 끝에 근거 배지                         │
└──────────────────────────────────────────┘
┌─ 🧭 해부 지도 ── (주사·캐뉼라 시술일 때만) ─────────┐
│ 얼굴 도식(정면/측면/45°) + 깊이 단면도 + 위험 구조물 표 │
└──────────────────────────────────────────┘
 더 볼까요?
 🔍 맞춤: [기미 vs ABNOM 감별] [아스피린 환자 출력 조정?] [재발 설명 멘트]
 📂 섹션: 유의사항 · 부작용/대처법 · 감별질환 · 시술팁 · 간격/회차 ·
          홈케어 · 마케팅/업셀링 · 비슷한 치료 · 참고사항
 🔬 [문헌 근거 찾기]
 💬 [ 직접 물어보기…                                   ]

┌─ 펼친 카드들 (아래로 쌓임, 각각 스트리밍) ─────────────┐
│ … 본문 …                                  [＋노트로 저장] │
└──────────────────────────────────────────┘
```

### 2.1 입력 → 칩 + 플래그 (약 1초)

- 한 줄 자유입력을 Haiku가 `ParsedCase`로 파싱한다: `patient[]`, `conditions[]`, `meds[]`, `procedures[]`.
- 칩은 ✕로 지우거나 직접 추가할 수 있다. 칩이 바뀌면 **세션을 새로 만들고 브리핑부터 다시 생성**한다.
- **플래그는 두 가지 경로로 만든 뒤 합친다.** 모델이 놓쳐도 결정론적 규칙이 잡아내게 하려는 것이다.
  1. 규칙 기반(`lib/bbip/flags.ts`): 키워드 사전으로 판정한다. 대상은 임신·수유, 이소트레티노인, 항응고·항혈소판제, 켈로이드 체질, 자가면역질환, 활동성 감염·HSV, 과거 필러 부작용, 광과민 약물.
  2. 파서 모델이 추가로 제시한 플래그.
- 레벨은 `contraindication`(빨강)과 `caution`(주황) 두 가지다.
- **원문 입력은 DB에 저장하지 않는다.** 칩만 저장한다. 입력창에는 "이름·연락처 등 식별정보는 입력하지 마세요" 안내를 둔다.

### 2.2 핵심 브리핑

- 5~7줄로 쓴다. 금기·주의 → 핵심 시술팁 → 주요 리스크 → 회차 → 한 줄 업셀 순서다.
- 플래그가 있으면 첫 줄은 반드시 그 내용이다.
- 스트림이 끝나면 **이 케이스 맞춤 후속 질문 3~4개**를 함께 반환해 칩으로 보여준다.

### 2.3 파고들기 (turn)

카드는 네 종류다. 누르면 브리핑 아래에 카드가 추가되고 스트리밍된다.

| kind | 내용 |
|---|---|
| `section` | 고정 섹션 9개 중 하나 (§6.6) |
| `followup` | 브리핑이 제안한 맞춤 질문 |
| `custom` | 직접 입력한 질문 |
| `literature` | 🔬 문헌 근거 찾기 (§4) |

같은 세션의 이후 turn은 앞선 브리핑과 펼친 카드들을 맥락으로 이어받는다.

### 2.4 히스토리

- 좌측(모바일에서는 드로어)에 최근 세션 목록을 둔다. 칩 요약과 시각을 표시한다.
- 세션을 열면 브리핑, 해부 지도, 펼쳤던 카드가 그대로 복원된다.

## 3. 근거 모델과 배지

모델은 모든 주장 뒤에 마커를 붙이고, 렌더러(`lib/bbip/evidence.ts`)가 마커를 배지로 바꾼다.

| 마커 | 배지 | 출처 | 클릭 시 |
|---|---|---|---|
| `[n]` | 📚 n | 내 노트 (검색된 n번째) | 노트 페이지 |
| `[n]` + 노트 claim에 교과서 출처 | 📖 *책명* p.x | 인제스트된 교과서·서적 | 노트 페이지(해당 claim) |
| `[P1]` | 🔬 P1 | PubMed 논문 | PubMed 링크(PMID) |
| `[W1]` | 🌐 W1 | 의학 도메인 웹 문서(가이드라인, 허가사항 등) | 원문 URL |
| `[AI]` | 🤖 AI | 모델 일반지식 | 툴팁: "검증되지 않은 AI 보충" |

**출처 우선순위 규칙 (프롬프트에 명시):** 내 노트 > 문헌(P/W) > AI.

- 내 노트나 문헌에 있는 내용을 `[AI]`로 다시 쓰지 않는다.
- **`[AI]` 문장에는 구체 용량·파라미터·수치를 쓰지 않는다.** 대신 "제품 IFU/허가사항 확인"으로 안내한다.
- 출처끼리 내용이 충돌하면 한쪽을 고르지 않고 `> ⚠️ 충돌:` 블록으로 드러낸다.

## 4. 문헌 보강 (버튼을 눌렀을 때만)

🔬 **문헌 근거 찾기**를 누르면 실행한다.

1. **검색어 생성**: Haiku가 칩을 영어 PubMed 쿼리(MeSH 우선)와 웹 쿼리로 바꾼다.
2. **PubMed** (`lib/bbip/literature/pubmed.ts`)
   - NCBI E-utilities를 쓴다: `esearch.fcgi`(db=pubmed, sort=relevance, retmax=8) → `efetch.fcgi`(rettype=abstract, retmode=xml).
   - 결과를 `{pmid, title, authors, year, journal, abstract, publicationTypes}`로 정리한다.
   - publicationTypes로 근거수준을 매핑한다: Meta-Analysis·Systematic Review > RCT > Cohort·Observational > Case Report > Review/기타.
   - `NCBI_API_KEY` env는 선택이다. 키가 없으면 초당 3회 제한을 지킨다.
3. **웹** (`lib/bbip/literature/web.ts`)
   - Claude API의 웹검색 서버 툴을 `allowed_domains`로 제한해서 쓴다.
   - 허용 도메인 기본값: `pubmed.ncbi.nlm.nih.gov`, `ncbi.nlm.nih.gov`, `nih.gov`, `jaad.org`, `onlinelibrary.wiley.com`, `link.springer.com`, `academic.oup.com`, `journals.lww.com`, `mfds.go.kr`, `nedrug.mfds.go.kr`, `fda.gov`.
   - `BBIP_WEB_DOMAINS` env로 덮어쓸 수 있다.
   - 툴 버전 문자열은 구현 계획 단계에서 최신 문서로 확정한다.
4. **literature turn**: 검색 결과를 근거로 "문헌 근거" 카드를 스트리밍한다. `[P1]`/`[W1]` 인용을 쓰고, 각 문헌의 근거수준 배지를 표시한다.
5. **이후 turn에 반영**: 세션에 문헌 블록이 붙는다. 이후 펼치는 카드는 문헌도 근거로 쓸 수 있다.
6. **캐시**: `literature_cache`(키는 provider + 정규화된 쿼리, TTL 30일). 같은 검색은 다시 호출하지 않는다.

## 5. 🧭 해부 지도 (주사·캐뉼라 시술)

### 5.1 원칙 — 좌표는 AI가 그리지 않는다

혈관 위치를 모델이 만들어내면(환각) 위험하다. 그래서 해부 데이터는 **정적인 큐레이션 아틀라스**로 둔다.

- 아틀라스: `lib/bbip/anatomy/atlas.ts`. 구조물마다 정의된 SVG 경로·좌표, 깊이층, 위험도, 안전 술기 문구를 가진다.
- 어떤 부위·구조물을 보여줄지는 **시술 → 부위 매핑**(`lib/bbip/anatomy/regions.ts`)이 결정론적으로 고른다.
- 해부 지도는 **AI 호출 없이** 즉시 렌더된다. 브리핑과 동시에 뜬다.
- 아틀라스 초안은 표준 해부학 지식으로 작성하되, 화면에 **"원장 검토 전 초안"** 배지를 단다. 원장이 구조물별로 `reviewedBy/reviewedAt`을 채우면 배지가 사라진다. 이 값은 아틀라스 파일에 직접 기록한다.

### 5.2 화면 구성 (`components/bbip/anatomy/`)

1. **얼굴 도식 `FaceMap.tsx`**
   - 정면 / 45° / 측면 3개 뷰를 탭으로 전환해서 입체감을 준다.
   - 레이어를 켜고 끌 수 있다: 동맥(빨강), 정맥(파랑), 신경(노랑), 지방구획, 인대, 위험구역(반투명 빨강 해칭), 권장 진입점·벡터(실리프팅·캐뉼라).
   - 이번 시술 부위가 하이라이트되고, 나머지는 흐리게 표시된다.
   - 구조물을 탭하거나 호버하면 툴팁이 뜬다: 이름(한/영), 주행, 깊이층, 위험, 안전 술기.
2. **깊이 단면도 `DepthCrossSection.tsx`**
   - 부위별 층 구조를 세로 스택 그래프로 그린다: 피부 → 피하지방 → SMAS/근육 → 심부지방 → 골막.
   - 각 층에 그 부위의 혈관·신경이 지나가는 위치를 점과 선으로 표시한다.
   - 시술별 **권장 주입·삽입 평면**을 초록 밴드로 표시한다. 예: 눈물고랑 필러는 골막 위, 실리프팅은 피하층.
3. **위험 구조물 표 `StructureTable.tsx`**
   - 열: 구조물 | 위치(랜드마크 기준) | 깊이 | 위험 | 안전 술기 | 근거.
   - 위험도 순으로 정렬한다. 근거 열에는 아틀라스 출처, 그리고 관련 내 노트가 있으면 📚를 표시한다.
4. **📖 내 자료 그림 `MyFigures.tsx`**
   - 검색된 노트에 붙은 기존 `figures`(현재 394개) 중 캡션이 해부 키워드나 부위와 맞는 것을 썸네일로 보여준다.
   - 클릭하면 크게 보이고, 원 노트로 이동할 수 있다.

### 5.3 v1 아틀라스 범위

| 부위 | 핵심 구조물 |
|---|---|
| 이마·미간 | supratrochlear a., supraorbital a./n., 미간 위험구역 |
| 관자 | superficial temporal a., middle temporal v., 안면신경 측두분지, temporal fat pad 층 |
| 코 | dorsal nasal a., lateral nasal a., angular a., 비배부 정중 진입 |
| 눈밑·눈물고랑 | infraorbital foramen/a./n., angular a./v., 안와지지인대 |
| 중안면·볼 | zygomatic ligament, SOOF/deep medial cheek fat, 안면신경 관골분지, parotid duct |
| 팔자 | facial a. 주행, angular a. 이행부 |
| 입술·입가 | superior/inferior labial a.(점막하 깊이), mental foramen |
| 턱·턱선 | mental a./n., facial a.의 하악연 교차점, marginal mandibular n. |

시술 → 부위 매핑 대상:
- face-filler, body-filler(얼굴 외 부위는 v1에서 표만 표시), filler-dissolving
- collagen-stimulator(쥬베룩 볼륨·엘란쎄 등), thread-lifting
- 주사 방식 skin-booster(얼굴 부위)
- botox-wrinkle·botox-muscle: 근육 레이어만 표시

### 5.4 AI와 연결되는 지점

- 브리핑과 섹션 프롬프트에는 해당 부위 아틀라스 구조물의 **이름과 위험 요약 목록**만 넣는다. 그래서 모델이 "이번 케이스에서 특히 주의할 구조물"을 언급할 때 아틀라스의 구조물 ID 범위 안에서만 언급한다.
- 모델 출력의 `{{atlas:angular-artery}}` 같은 토큰은 칩으로 렌더된다. 클릭하면 해부 지도에서 해당 구조물이 강조된다.
- 아틀라스에 없는 ID는 렌더러가 일반 텍스트로 떨어뜨린다.

## 6. 아키텍처

### 6.1 모듈

```
lib/bbip/
  types.ts            ParsedCase, Flag, SectionKey, TurnKind, StreamEvent
  parse.ts            Haiku 파서 (zod 구조화 출력) + fake 모드
  flags.ts            규칙 기반 플래그 사전 + 병합
  sections.ts         섹션 9개 정의: key, label, model tier, 노트 승격 시 tier, 지시문
  prompts.ts          정적 시스템 프롬프트, 케이스/노트/문헌/아틀라스 블록, turn 지시문
  context.ts          세션 → 프롬프트 메시지 조립 (캐시 브레이크포인트 배치)
  evidence.ts         마커([n] [P1] [W1] [AI] {{atlas:…}}) 파싱 → 토큰 배열
  followups.ts        브리핑 꼬리 <followups> 블록 추출
  literature/
    pubmed.ts  web.ts  cache.ts  query.ts
  anatomy/
    atlas.ts   regions.ts   layers.ts
lib/services/bbipService.ts   세션/턴 CRUD, 노트 승격, 히스토리
app/api/bbip/
  sessions/route.ts                 POST 생성(파싱+플래그+검색), GET 목록
  sessions/[id]/route.ts            GET 세션 + 턴들
  sessions/[id]/turns/route.ts      POST 턴 생성 → NDJSON 스트림
  sessions/[id]/literature/route.ts POST 문헌 검색 → literature 턴 스트림
  turns/[turnId]/promote/route.ts   POST 노트로 저장
components/bbip/
  BbipConsole.tsx CaseInput.tsx ChipBar.tsx FlagBanner.tsx BriefCard.tsx
  MoreMenu.tsx TurnCard.tsx EvidenceText.tsx HistoryDrawer.tsx PromoteDialog.tsx
  anatomy/ FaceMap.tsx DepthCrossSection.tsx StructureTable.tsx MyFigures.tsx
```

### 6.2 데이터 (Drizzle 마이그레이션 1개)

```
bbip_sessions
  id, chips json(ParsedCase), flags json(Flag[]), source_note_ids json(string[]),
  anatomy_regions json(string[]), literature json(LiteratureRef[] | null),
  prompt_version, created_at
bbip_turns
  id, session_id → bbip_sessions (cascade), kind(brief|section|followup|custom|literature),
  section_key?, question?, output text, followups json?, model, status(streaming|done|failed),
  error?, promoted_entry_id?, created_at
literature_cache
  key (provider:normalized query) PK, provider(pubmed|web), results json, fetched_at
```

- 원문 입력 컬럼은 **두지 않는다**.
- 기존 `sources`, `entry_claims` 스키마는 바꾸지 않는다. 노트 승격 때 그대로 쓴다.

### 6.3 스트리밍 프로토콜

turn API는 NDJSON 이벤트를 흘려보낸다.

```
{"type":"delta","text":"…"}
{"type":"followups","items":["…","…"]}   // 브리핑만
{"type":"done","turnId":"…"}
{"type":"error","message":"…"}
```

- 서버는 모델 스트림에서 `<followups>` 블록을 걸러내 `followups` 이벤트로 따로 보낸다.
- `done` 시점에 turn 행을 `done`으로 확정한다.
- 클라이언트 연결이 끊겨도 서버는 생성을 끝까지 마치고 저장한다. 히스토리에서 다시 볼 수 있게 하려는 것이다.

### 6.4 프롬프트 구성과 캐시

메시지 순서(앞부분일수록 캐시가 오래 유지된다):

1. **시스템 프롬프트**: 정적 문자열. 역할, 근거 규칙(§3), 형식 규칙, 안전 규칙. → 캐시 브레이크포인트 ①
2. **케이스 블록 + 검색 노트 약 12개(발췌) + 아틀라스 구조물 목록** → 캐시 브레이크포인트 ②
3. **문헌 블록** (있을 때만)
4. **앞선 turn 요약**: 브리핑 원문 + 펼친 카드 제목·첫 문단(상한 약 3k자)
5. **이번 turn 지시문**: 섹션 지시 / 맞춤 질문 / 직접 질문

- 노트 검색은 세션을 만들 때 **한 번만** 하고 `source_note_ids`로 고정한다. 그래서 같은 세션의 모든 turn이 ② 앞부분을 캐시에서 읽는다.
- `custom` 질문이 노트 범위를 벗어날 때만 추가 검색을 하고, 그 결과는 지시문 쪽에 붙인다. 캐시 앞부분은 건드리지 않는다.

### 6.5 모델 배정 (`lib/ai/client.ts` 확장)

| 작업 | 모델 | env |
|---|---|---|
| 파싱, 문헌 쿼리 생성, 노트 승격 카테고리 제안 | Haiku | `CODEX_AI_MODEL_LIGHT` → 기본 `claude-haiku-5-5` |
| 브리핑 | Opus, 낮은 effort | `BBIP_BRIEF_MODEL`(기본 = `CODEX_AI_MODEL`), `BBIP_BRIEF_EFFORT`(기본 `low`) |
| 유의사항 · 부작용/대처법 · 감별질환 · custom | Opus | `CODEX_AI_MODEL` → 기본 `claude-opus-5-5` |
| 시술팁 · 간격/회차 · 홈케어 · 마케팅/업셀링 · 비슷한 치료 · 참고사항 · literature | Sonnet | `CODEX_AI_MODEL_MID` → 기본 `claude-sonnet-5-5` |

기존 Cognitio 기능의 모델 기본값도 같은 5.5 계열로 함께 올린다.

### 6.6 섹션 9개와 노트 승격 tier

| key | 라벨 | 그룹 | 모델 | 승격 tier |
|---|---|---|---|---|
| `cautions` | 유의사항 | 안전 | Opus | procedure_tip |
| `adverse` | 부작용 주의 · 대처법 | 안전 | Opus | procedure_tip |
| `ddx` | 감별질환 | 안전 | Opus | deep_study |
| `tips` | 시술팁 | 실무 | Sonnet | procedure_tip |
| `schedule` | 시술 간격 · 회차 | 실무 | Sonnet | procedure_tip |
| `homecare` | 시술 후 홈케어 | 실무 | Sonnet | chairside_talk |
| `marketing` | 마케팅 · 업셀링 멘트 | 비즈니스 | Sonnet | chairside_talk |
| `alternatives` | 비슷한 치료 · 병행 시술 | 비즈니스 | Sonnet | deep_study |
| `notes` | 참고사항 | 실무 | Sonnet | procedure_tip |

## 7. 노트로 저장 (승격)

- 카드 전체, 또는 카드 안에서 드래그로 선택한 부분을 저장할 수 있다.
- 다이얼로그에서 제목(AI 제안), 카테고리(Haiku가 leaf enum 중 제안, 수정 가능), tier(위 표 기본값)를 확인한 뒤 기존 `entryService.createEntry`로 저장한다.
- **출처**
  - 본문의 `[n]` 노트 인용은 `entry_relations` 링크로 바꾼다.
  - `[P#]`는 `sources(type=paper, url=PubMed, authors, year, evidenceLevel)`로, `[W#]`는 `sources(type=website 또는 manufacturer_guideline)`로 넣는다.
  - `[AI]`만 있는 내용의 출처는 `sources(type=other, citation="BBIP AI 보충 · <모델> · <날짜>")`로 한다.
- **상태**: `status=draft`. 각 문장 claim은 `representation=ai_paraphrase`, `evidenceLevel`은 문헌이 있으면 그 수준, 없으면 `unknown`이다.
  - 기존 검토 UI에 "검토 필요"로 뜬다.
  - 검토 전에는 BBIP 검색에서 이 노트를 **📚가 아닌 🤖 성격으로 취급**한다. 검색 결과에서 `status=draft`이면서 BBIP 출처인 노트는 `[AI]`급으로 표시해, 검증되지 않은 내용이 순환해서 근거로 굳어지는 것을 막는다.
- 승격된 turn에는 `promoted_entry_id`를 기록하고, 버튼은 "✓ 노트에 저장됨" 링크로 바뀐다.

## 8. 리브랜딩

- 앱 이름, 메타 타이틀, 로고 텍스트를 **BBIP**로 바꾼다. 부제는 "미용 GP 진료 비서".
- `/`는 BBIP 콘솔이 된다. 기존 랜딩/대시보드(`LandingHero` 등)는 `/kb`로 옮긴다.
- 상단 메뉴: **BBIP** · LIBRARY · CHUNK! · ANKI's · ASK to · Qmemo · Sort. 기존 라벨과 순서는 유지하고, 맨 앞에 BBIP만 추가한다.
- 패키지 이름(`cognitio`)이나 DB 파일 경로는 바꾸지 않는다. 데이터 호환을 위해서다.
- README에 BBIP 섹션을 추가하고, 낡은 서술(`classify.ts` NOT IMPLEMENTED 등)을 고친다.

## 9. 에러 처리

| 상황 | 동작 |
|---|---|
| 파서 실패 / 타임아웃 | 규칙 기반 플래그 + 입력을 쉼표로 나눈 단순 칩으로 대체하고 계속 진행. "자동 분류 실패 — 칩을 확인하세요" 안내 |
| turn 생성 실패 | 그 카드에만 오류와 [다시 시도]. turn을 `failed`로 저장. 다른 카드는 영향 없음 |
| 검색 노트 0개 | 브리핑 상단에 "내 노트에 관련 자료 없음" 표시. 본문은 `[AI]` 위주. 🔬 문헌 찾기 칩을 강조 |
| PubMed / 웹 실패·0건 | literature 카드에 "문헌을 찾지 못함"과 사용한 쿼리를 표시. 한쪽 provider만 실패하면 다른 쪽 결과로 진행 |
| 아틀라스 매핑 없는 시술 | 해부 지도 카드를 숨김 |
| API 키 없음 / fake 모드 | 결정론적 가짜 칩·브리핑·섹션·문헌으로 전체 흐름 동작 (`CODEX_AI_MODE=fake`) |

## 10. 테스트

**단위 (Vitest, fake 모드)**
- `flags`: 키워드별 플래그 판정, 중복 병합.
- `parse`: fake 파서 출력 스키마, 실패 시 대체 경로.
- `evidence`: 마커 파싱(`[1][3]`, `[P2]`, `[AI]`, `{{atlas:…}}`, 아틀라스에 없는 ID 처리).
- `followups`: 스트림 조각 경계에 걸친 `<followups>` 블록 추출.
- `pubmed`: 저장된 XML 픽스처 파싱, publicationType → 근거수준 매핑.
- `literature/cache`: TTL, 키 정규화.
- `anatomy`: 모든 `regions` 매핑이 존재하는 아틀라스 ID만 참조하는지, 모든 구조물에 깊이층·위험도가 있는지.
- `context`: 같은 세션 turn들의 캐시 앞부분(①②)이 바이트 단위로 같은지.
- `bbipService`: 세션/턴 저장에 원문 입력이 없는지, 승격 시 sources·claims·draft 상태가 맞는지, BBIP draft 노트가 `[AI]`급으로 다운그레이드되는지.

**E2E (Playwright, fake 모드)**: 1개 흐름.
1. 입력 → 칩·플래그 → 브리핑 → 해부 지도 표시(필러 입력).
2. 섹션 1개 펼침 → 🔬 문헌 → 노트로 저장 → 라이브러리에서 draft 확인.
3. Axe 접근성 검사.

**기존 108개 테스트와 타입체크가 계속 통과해야 한다.**

## 11. 이후 (v2 후보)

- 진짜 3D 두상 뷰어(three.js + 라이선스 해부 모델). 아틀라스 ID를 3D 메쉬에 매핑한다.
- 칩 하나만 바뀌었을 때 영향받는 카드만 부분 재생성.
- 원장이 아틀라스 구조물을 앱 안에서 직접 편집·검토하는 UI.
- 바디 부위(엉덩이·손등 등) 아틀라스 도식.
