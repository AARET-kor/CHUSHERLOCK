# BBIP Papers (미용 논문 자동 수집·분석·진료 반영) 설계

- 작성일: 2026-11-04
- 기반: `main` @077342a (케이스 기록 + 카테고리 태그)
- 상위 설계: `docs/superpowers/specs/2026-10-18-bbip-design.md`
- 상태: 설계 확정 대기 (사용자 결정 반영: 저널 표 IF, 주 5편 자동 분석, 재분석 없음, 브리핑 자동 반영 + 미검토 표시)

## 1. 목표

미용 논문을 자동으로 모으고, 논문의 한계까지 읽어 시술과 상담에 쓸 수 있는 시사점으로 정리한다.

1. 필러, 실리프팅, HIFU·고주파 리프팅, 색소 레이저 논문을 매주 자동으로 모은다.
2. Knowledge › PAPERS에서 **IF 높은 순**으로 본다.
3. 대상·재료·추적 기간·저자가 쓴 한계를 짚어, "이 논문이 말할 수 있는 것과 없는 것"을 분명히 한다.
4. 케이스를 넣으면 시술에 맞는 논문이 브리핑에 인용으로 들어간다.

### 하지 않는 것

- 논문을 노트(`entries`)로 자동 저장. 근거 순서(내 노트 > 문헌 > AI)를 유지하려고 별도 서재로 둔다. 노트로 저장하는 버튼도 이번 범위에서 뺀다.
- 분석이 끝난 논문의 재분석. 재분석 버튼을 두지 않는다.
- 전문 저장. 전문은 분석할 때만 받아 쓰고 버린다. 저장되는 원문은 초록과 짧은 한계 인용문뿐이다.
- 유료 저널 전문 입수. 전문이 없으면 초록으로 분석하고 그렇게 표시한다.
- 보톡스·스킨부스터·콜라겐 자극제 주제. 주제 정의에 추가하면 넓힐 수 있게 만들되 지금은 넣지 않는다.

## 2. 주제와 수집

### 주제

| key | 라벨 | PubMed 검색 묶음 (요지) | 연결되는 시술 |
|---|---|---|---|
| `filler` | Filler · 필러 | Dermal Fillers[Majr], 제목의 filler, dermal·HA filler, 필러 관련 hyaluronidase | taxonomy major `filler` |
| `thread` | Thread lift · 실리프팅 | thread lift, 제목의 thread, 안면거상 관련 barbed suture | major `lifting`, mid `실리프팅` |
| `energy` | HIFU·RF · 에너지 리프팅 | Ultherapy, microfocused ultrasound, Thermage, HIFU·고주파 중 lifting·tightening·laxity·rejuvenation·wrinkle | major `lifting`, mid `HIFU`·`RF` |
| `pigment` | Pigment laser · 색소 레이저 | melasma·lentigo·nevus of Ota 등 + laser, laser toning, 색소 관련 picosecond·Q-switched | major `laser`, mid `토닝`·`색소·점`, 또는 케이스 질환이 기미·색소 |

주제별 색은 카테고리 태그 팔레트를 재사용한다(`lib/records/taxonomy.ts`).

### 저널 표

- 미용·피부·성형 저널 약 30곳을 `journals`에 넣는다. 키는 PubMed 저널 약어(`[ta]`)다.
- 시작값은 **검증되지 않은 근사값**이다. 화면에는 `IF ≈ 3.7`로 쓰고, 표에 기준 연도를 함께 둔다.
- 저널 표 화면에서 값을 고치면 정렬에 바로 반영된다. 값을 고쳤다는 표시(`edited`)가 남고, 시드 재실행이 덮어쓰지 않는다.
- PubMed 검색은 표에 있는 저널로 한정한다. IF 값이 없는 저널은 목록 맨 아래로 간다.

### 수집 흐름

1. 첫 실행: 최근 5년. 이후: 마지막 성공 수집일 이후. 주제별로 PubMed esearch → efetch.
2. Comment, Erratum, Editorial, Retracted Publication과 초록 없는 글은 넣지 않는다.
3. **중복 방지**: PMID가 기본키이고 DOI도 유일하다. 이미 있는 논문은 주제만 합치고 분석 상태는 건드리지 않는다.
4. 수집은 API 비용이 들지 않으므로 수량 상한을 두지 않는다. NCBI 호출은 기존 rate limiter를 공유한다.
5. 일정: LaunchAgent `lab.aret.bbip-papers`가 매주 월요일 06:00에 `POST /api/papers/sync`를 호출한다(접근 토큰은 `.env.local`에서 읽음). 맥이 꺼져 있었으면 launchd가 다음 깨어날 때 실행한다. PAPERS 화면에 마지막 수집 시각과 "지금 수집" 버튼을 둔다.

## 3. 분석

### 주 5편 자동 분석

- 매주 수집 뒤 **최대 5편**을 자동 분석한다. 비용 상한을 지키기 위해 실패한 시도도 5편에 포함한다.
- 고르는 순서: 네 주제에서 각각 가장 IF 높은 미분석 논문 1편씩, 남은 자리는 전체에서 IF 높은 순. 같은 IF면 최신 연도 우선. 순수 IF 순이면 논문이 많은 필러·색소만 분석되고 실리프팅(5년간 약 48편)이 계속 밀리기 때문이다.
- 목록의 "분석" 버튼은 원장이 고른 논문을 바로 분석하고, 주 5편에 포함하지 않는다.

### 재분석 방지

- 상태: `pending` → `analyzing` → `analyzed` | `failed`.
- `analyzed`는 끝 상태다. 자동 선택과 분석 API 모두 거부한다(API는 409).
- 시작은 `UPDATE … WHERE status IN ('pending','failed')` 한 번으로 선점해서, 주간 실행과 버튼이 겹쳐도 두 번 돌지 않는다.
- `failed`는 분석이 저장되지 않은 상태라 다시 시도할 수 있다. 자동 재시도는 3회까지이고 그 뒤로는 버튼으로만 한다.
- 서버 재시작으로 `analyzing`에 멈춘 건 10분이 지나면 `failed`로 되돌린다.
- IF 값을 고쳐도 재분석하지 않는다.

### 입력

- `pmcid`가 있으면 NCBI PMC efetch로 전문 XML을 받아 본문만 추린다. 없거나 실패하면 초록을 쓴다. 쓴 출처를 `source: "fulltext" | "abstract"`로 저장한다.
- 환자 정보는 보내지 않는다. 논문 본문은 `neutralizeTags`를 거쳐 지시가 아닌 자료로 넘긴다.
- 모델: `MID_MODEL`(Sonnet), JSON 스키마 출력. `CODEX_AI_MODE=fake`에서는 네트워크 없이 고정 결과를 낸다.

### 출력 (`papers.analysis`, 한국어)

```ts
interface PaperAnalysis {
  source: "fulltext" | "abstract";
  subject: { kind: "human" | "animal" | "in_vitro" | "review" | "unclear"; detail: string; n: number | null };
  material: string;        // 예: 비가교 HA, 쥐 피부 모델
  followUp: string | null; // 예: 4주, 4년
  findings: string[];      // 수치는 원문에 있는 그대로
  limitations: Array<{ text: string; quote: string | null; quoteVerified: boolean }>;
  canClaim: string[];      // 이 논문이 말할 수 있는 것
  cannotClaim: string[];   // 말할 수 없는 것
  implications: Array<{ kind: "procedure" | "consult"; text: string }>;
}
```

- `quoteVerified`는 모델이 아니라 코드가 정한다. 공백을 정규화한 뒤 입력 원문에 그 문장이 있으면 true다. 없으면 화면에 "인용 확인 안 됨"으로 표시한다.
- 초록만 분석했으면 저자가 쓴 한계를 볼 수 없다는 점을 `cannotClaim`에 넣게 하고, 화면에도 "초록만 분석"을 표시한다.

## 4. 데이터 (마이그레이션 0017)

- `journals`: `ta`(PK), `name`, `impact_factor`(real, null 가능), `if_year`, `edited`
- `papers`: `pmid`(PK), `doi`(unique, null 가능), `pmcid`, `title`, `authors`(json), `year`, `journal_ta`, `abstract`, `publication_types`(json), `level`, `topics`(json), `status`, `attempts`, `error`, `analysis`(json), `analysis_model`, `analyzed_at`, `review_status`(`unreviewed` | `reviewed` | `excluded`), `reviewed_at`, `created_at`
- `paper_sync_runs`: `id`, `kind`(`weekly` | `manual`), `started_at`, `finished_at`, `added`, `analyzed`, `error`

인덱스: `papers(status)`, `papers(journal_ta)`, `papers(year)`. `scripts/backup.mjs`는 DB 전체를 복사하므로 그대로 포함된다.

## 5. 화면

Knowledge 하위 메뉴에 `PAPERS`를 추가한다. 라벨은 영어 먼저, 아래 한글 규칙을 따른다.

- **`/papers`**: 기본 정렬 IF 높은 순(그다음 최신 연도). 정렬 전환은 최신순. 필터는 주제, 연구 유형, 사람/동물, 분석 여부, 검토 상태. 많으므로 페이지 단위(50편)로 서버에서 읽는다.
- **각 줄**: `IF ≈`, 제목, 저널·연도, 주제 태그, 대상·추적 기간, 전문/초록, 검토 상태. 미분석 논문에는 "분석" 버튼.
- **`/papers/[pmid]`**: 분석 전체, 초록, PubMed·DOI 링크, 검토 버튼(검토함 / 제외).
- **`/papers/journals`**: 저널 표. IF를 바로 수정.
- 상단에 이번 주 분석한 논문과 "AI 분석입니다. 인용 전 원문을 확인하세요" 안내를 둔다.

## 6. 진료 반영

- `openSession`에서 케이스의 시술·질환을 주제로 바꿔 논문 **최대 5편**을 고르고 `session.literature`에 넣는다. 맞는 주제가 없으면 넣지 않는다.
- 브리핑용 순서는 목록과 다르다: **분석됨 → 사람 연구 → 근거 수준(guideline > meta > rct > observational > case) → IF**. 제외한 논문은 넣지 않는다. 동물실험이 저널 등급만으로 사람 장기 추적보다 앞서지 않게 하려는 것이다.
- 주 5편이라 분석된 논문이 적을 때는 **미분석 논문을 초록만으로 채운다**. 이때는 시사점 없이 초록만 넘기고 "미분석"으로 표시한다.
- `PaperHit`에 선택 필드를 더한다: `analysis?`, `reviewStatus?`, `impactFactor?`. 기존 세션 데이터는 그대로 읽힌다.
- `buildLiteratureBlock`은 분석이 있으면 대상·재료·추적 기간·한계·시사점을 함께 넣고, `reviewed="false"` 속성을 단다. 프롬프트 규칙을 더한다: 미검토 분석은 사실로 단정하지 않고, 동물실험·짧은 추적 같은 한계를 함께 쓴다.
- 각주에는 `AI 분석·미검토` 또는 `미분석` 표시와 `IF ≈`를 붙인다.
- 🔬 문헌 근거 찾기는 그대로다. 기존 `mergeLiterature`가 뒤에 덧붙이므로 이미 붙은 [P#] 번호는 바뀌지 않는다. PMID가 같은 논문은 합친다.

## 7. 오류 처리

- PubMed 실패: 그 수집을 실패로 기록하고 마지막 성공 수집일을 움직이지 않아, 다음 실행이 빠진 기간을 다시 받는다.
- 전문 실패: 초록으로 넘어간다.
- 모델 거절·잘림·JSON 오류: `failed`와 오류 문구를 남기고 분석을 저장하지 않는다.
- 논문 선택 실패: 진료를 막지 않는다. 경고를 남기고 문헌 없이 세션을 연다.
- 주간 실행 중복: 진행 중인 실행이 있으면 새 호출은 409다.

## 8. 코드 구조

- `lib/papers/topics.ts`: 주제 정의, 쿼리, 시술·질환 → 주제 (순수)
- `lib/papers/journals.ts`: 저널 시드
- `lib/papers/fulltext.ts`: PMC XML → 본문 (순수 파서 + fetch)
- `lib/papers/analyze.ts`: 프롬프트, 호출, 인용 대조
- `lib/papers/select.ts`: 주간 5편 선택, 브리핑 5편 선택 (순수)
- `lib/services/paperService.ts`: DB 접근, 선점, 수집·분석 실행
- `app/api/papers/**`, `app/papers/**`, `components/papers/**`
- `scripts/install-papers-agent.sh`: LaunchAgent 설치
- PubMed 파서·rate limiter는 `lib/bbip/literature/pubmed.ts`를 재사용하고 DOI·PMCID 파싱과 `sort`, 날짜 범위, `retmax` 페이징을 더한다. 기존 호출 동작은 바꾸지 않는다.

## 9. 테스트

- 단위: 쿼리 생성, 시술 → 주제, 저널 필터, 주간 5편 선택(주제 1편씩, 상한, 분석됨 제외), 브리핑 선택 순서, 인용 대조, PMC 파서, 중복 수집, 선점(동시 2회 중 1회만), `analyzed` 재분석 409, 멈춘 `analyzing` 복구, 프롬프트 블록.
- E2E(fake): 수집 → IF 순 목록 → 분석 → 검토 → 케이스 입력 시 [P#] 인용과 미검토 표시 → 제외 후 빠짐 → axe.
- 실제 API 확인: 수집 1회와 분석 1편(Yin 2026, PMID 42136041). 저자 Limitations 문단이 인용되고 `quoteVerified`가 true인지 본다.

## 10. 알려진 한계

- 2,100편 중 주 5편이면 연 260편 정도라 **자동 분석만으로는 전체를 다 보지 못한다**. 나머지는 버튼으로 분석한다.
- IF 시작값은 근사값이다. 정확한 값은 JCR로 원장이 고쳐야 한다.
- 수집 뒤 철회된 논문은 자동으로 잡지 못한다. 수집 시점에 철회 표시가 있는 글만 거른다.
