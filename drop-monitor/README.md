# 드롭 모니터 — Chrome Hearts · SKYLRK · CPFM · Denim Tears

크롬하츠(chromehearts.com), SKYLRK(skylrk.com), Cactus Plant Flea Market(cactusplantfleamarket.com),
Denim Tears(denimtears.com) 공식 스토어를 계속 확인하다가
**새 드롭이 뜨면 텔레그램으로 한국어 알림을 보내고, 원하는 사이즈로 바로 살 수 있는 링크를 줍니다.**
후디·후드집업을 가장 먼저 챙기고, 신발·액세서리·바카라 글라스·속옷 같은 건 따로 모아 알림을 보내지 않습니다.

Python 3.9 이상만 있으면 되고 추가 설치는 없습니다.

![대시보드](docs/dashboard.png)

## 빠른 시작 (내 컴퓨터)

```bash
cd ~/chusherlock/drop-monitor
cp config.example.json config.json     # 설정 (아래 표)
python3 -m chmonitor --setup-telegram  # 텔레그램 연결 — 아래 단계별 설명
python3 -m chmonitor --dashboard       # 감시 + 대시보드 http://127.0.0.1:8787
```

다른 명령: `--list`(지금 판매 중인 상품, 그룹별), `--test-notify`(테스트 알림), `--once`(한 번만 확인),
`--reset`(기준 다시 잡기), `--store skylrk`(한 스토어만), `-v`(자세한 로그).

**처음 실행하면** 지금 상품을 기준으로 저장만 하고 알림은 보내지 않습니다. 두 번째 확인부터 알림이 갑니다.

## 텔레그램 알림 설정 (5분)

### 1. 봇 만들기 (휴대폰 텔레그램에서)
1. 텔레그램 검색창에 **`@BotFather`** 를 검색해 들어갑니다 (파란 체크 표시가 있는 공식 계정).
2. **시작(START)** → `/newbot` 을 보냅니다.
3. 봇 **이름**을 보냅니다. 아무거나 됩니다 (예: `내 드롭 알림`).
4. 봇 **아이디**를 보냅니다. 영어로, 끝이 `bot` 이어야 합니다 (예: `aaret_drop_bot`). 이미 있는 이름이면 다른 걸로.
5. BotFather가 `123456789:AAH...` 같은 **토큰**을 줍니다. 이게 봇 비밀번호입니다. **채팅이나 ChatGPT에 붙여 넣지 마세요.**

### 2. 모니터에 연결 (맥 터미널에서)
```bash
cd ~/chusherlock/drop-monitor
python3 -m chmonitor --setup-telegram
```
1. `봇 토큰:` 이 나오면 토큰을 붙여 넣고 Enter. **화면에 글자가 안 보이는 게 정상**입니다.
2. `✓ 봇 확인: @aaret_drop_bot` 과 `https://t.me/aaret_drop_bot` 링크가 나옵니다.
3. 휴대폰에서 그 봇을 열고 **시작** 버튼을 누릅니다 (2분 안에).
4. `✓ 대화 확인`, `✓ config.json 에 저장`, `✓ 테스트 메시지를 보냈습니다` 가 나오고 텔레그램에 연결 완료 메시지가 옵니다.
5. `python3 -m chmonitor --test-notify` 로 크롬하츠·SKYLRK 테스트 알림을 한 번 더 받아 보세요.

### 알림은 이렇게 옵니다
```
🔥 [SKYLRK] 후디 신상품
NO ZIP - DOTS
💵 $240 (약 319,000원)
📏 재고 있음: XS · S · M  (품절: L · XL · XXL)
🏷 후디 · 후디·집업
🕒 11월 20일 오후 3:05 포착
[🛒 M 사이즈 바로 결제]  [👀 상품 보기]
```
- 상품 사진이 함께 옵니다. 상품 이름만 스토어 공식 영문 이름 그대로입니다 (검색할 때 필요해서).
- 🔥 후디·집업, 🚨 그 밖의 의류, 📦 재입고, 🔁 다시 올라온 상품, 새 카테고리/컬렉션 오픈.
- **SKYLRK**: 선호 사이즈에 재고가 있으면 버튼이 **그 사이즈가 담긴 결제 화면**으로 바로 갑니다 (Shopify 장바구니 링크).
- **크롬하츠**: 선호 사이즈가 선택된 상품 페이지로 갑니다. 거기서 장바구니 → 결제.
- 결제 버튼은 내가 누르는 것까지입니다. 자동 결제는 하지 않습니다 (약관 위반·계정 차단 위험, 카드 정보 보관 문제).

## 상품 그룹

| 그룹 | 무엇 | 대시보드 | 알림 (기본) |
|---|---|---|---|
| 🔥 **후디·집업** `hoodie` | 후디, 후드집업, 노집 후디 | 메인 맨 위 | **보냄**, 재입고까지 감시 |
| **상의** `top` | 맨투맨·크루넥, 티셔츠·롱슬리브, 셔츠·폴로, 니트·가디건, 쿼터집 스웻 | 메인 | **보냄** |
| **하의·아우터** `apparel` | 팬츠·스웻팬츠·데님·쇼츠, 자켓·코트·패딩·플리스·베스트, 분류 못 한 옷 | 메인 (작게) | 안 보냄 |
| **신발·액세서리** `accessory` | 신발, 모자, 아이웨어, 폰 케이스, 가방, 주얼리, 두건, 핀·키링 | 별도 탭 | 안 보냄 |
| **기타** `other` | 바카라 글라스, 향·캔들, 속옷·레깅스, 양말, 키즈, LP·책 | 별도 탭 | 안 보냄 |

알림 대상은 `alert_groups`로 바꿉니다 (예: 하의·아우터도 받으려면 `["hoodie", "top", "apparel"]`).
Railway에서는 변수 `CH_CONFIG_JSON`에 `{"alert_groups":["hoodie","top","apparel"]}`처럼 넣으면 됩니다.

## ⚡ 우선 알림 — 크롬하츠 후디 M·XL

크롬하츠 **후디·후드집업**이 새로 올라오거나 재입고됐는데 **M 또는 XL** 재고가 있으면 일반 알림 대신 우선 알림이 갑니다.

```
🔥🔥 [Chrome Hearts] 후디 M 재고 — 지금 구매
CEMETERY HOODIE
⚡ M 사이즈가 선택된 페이지로 바로 열립니다
💵 $1,450 (약 1,930,000원)
📏 재고 있음: M · L · XL
[🛒 M 사이즈로 지금 구매]  [👀 상품 보기]
```

- 버튼을 누르면 **M(없으면 XL)이 이미 선택된 상품 페이지**가 열립니다 → 장바구니 → 결제.
- 놓치지 않게 **20초 간격으로 2번 더** 텔레그램이 다시 울립니다.
- 재입고는 우리 사이즈(M·XL)가 돌아온 경우만 우선 알림입니다. L만 돌아오면 일반 알림.
- 대시보드에서는 해당 상품에 노란 **⚡ M·XL** 표시가 붙습니다.
- 바꾸기: `"priority": [{"store": "chromehearts", "groups": ["hoodie"], "sizes": ["M", "XL"], "repeat": 2, "repeat_every": 20}]`
  (끄기 `"priority": []`, 다른 스토어도 같은 형식으로 추가)

자동 주문·결제는 하지 않습니다. 크롬하츠 약관이 봇 구매를 금지하고(주문 취소·계정 차단 사유), 결제 단계에 reCAPTCHA와
결제사 기기 인증이 있어 우회 없이는 안정적으로 동작하지 않기 때문입니다.

### 구매 준비 체크리스트 (알림 오기 전에 미리)
1. **배송지**: 크롬하츠 온라인은 **미국 배송만** 됩니다(약관상 미국 거주자 대상). 미국 배송대행지 주소를 준비하세요.
2. **계정**: chromehearts.com 계정을 만들고 로그인 상태를 휴대폰 브라우저에 유지 → 주소록에 배송대행 주소 저장.
3. **결제수단**: 미국 결제가 되는 카드를 준비하고, 카드 앱의 해외결제·온라인결제를 켜 두기. 휴대폰 브라우저 자동완성에 카드 저장.
4. **연습**: 지금 판매 중인 아무 상품으로 결제 직전 단계(리뷰 화면)까지 한 번 가 보기 — 실제 드롭 때 막히는 곳을 미리 찾습니다.
5. 텔레그램 알림 소리와 "방해 금지 모드 예외"에 이 봇을 넣어 두기.

## 대시보드

`python3 -m chmonitor --dashboard` → http://127.0.0.1:8787

- 맨 위 **CHROME HEARTS | SKYLRK | CPFM | DENIM TEARS** 버튼(키보드 `1`~`4`, 주소 `#cpfm` 등)으로 스토어를 바꾸면 로고·색·상품이 그 스토어로 바로 바뀝니다.
  버튼의 빨간 숫자는 지금 판매 중인 후디 수입니다.
- 메인 탭: 새로 포착 → 🔥 후디·후드집업 → 그 밖의 의류. 신발·액세서리 / 기타 / 전체는 별도 탭.
- 가격은 달러와 원화(실시간 환율 단순 환산), 사이즈별 재고(품절은 취소선, 선호 사이즈는 굵게).

## 맥을 꺼도 돌아가게 — 서버에 올리기

**Vercel은 맞지 않습니다.** Vercel은 요청이 올 때만 잠깐 실행되는 서버리스라서 계속 돌면서 1분마다 확인하는
프로그램을 둘 수 없고(무료 크론은 하루 1번), 상태를 저장할 디스크도 없습니다.

**추천: Railway** — 이 저장소의 BBIP 앱이 이미 Railway에 있으니 같은 프로젝트에 서비스 하나만 추가하면 됩니다.
이 모니터는 메모리·CPU를 거의 안 써서 Hobby 플랜($5/월 포함 사용량) 안에서 충분합니다.

1. Railway 대시보드 → 프로젝트 → **+ New → GitHub Repo** → `aaret-kor/chusherlock` 선택.
2. 새 서비스 **Settings**
   - **Source → Root Directory**: `drop-monitor`
   - **Source → Branch**: 이 코드가 있는 브랜치 (main에 합친 뒤라면 `main`)
   - (Config-as-code 경로를 묻는 경우) `drop-monitor/railway.json`
   - Dockerfile로 빌드되고, 헬스체크는 `/healthz`, 꺼지면 자동 재시작됩니다.
3. **Variables** 에 추가
   | 이름 | 값 |
   |---|---|
   | `CH_TELEGRAM_BOT_TOKEN` | BotFather 토큰 (맥 `config.json`의 `telegram.bot_token`과 같은 값) |
   | `CH_TELEGRAM_CHAT_ID` | 맥 `config.json`의 `telegram.chat_id` 값 |
   | `CH_CONFIG_JSON` | (선택) 설정 JSON 한 줄, 예: `{"preferred_sizes":["L","M"]}` |
4. **Volume** 추가 → Mount path `/data` (알림 기록·기준 상태 저장. 없으면 재배포 때마다 기준을 새로 잡습니다).
5. **Settings → Networking → Generate Domain** → `https://xxxx.up.railway.app` 에서 대시보드 확인.
   대시보드는 비밀번호 없이 열립니다. 다시 잠그려면 변수 `CH_DASHBOARD_REQUIRE_PASSWORD=1`과
   `CH_DASHBOARD_PASSWORD`(8자 이상)를 넣으세요. 페이지에는 토큰 같은 비밀값이 나가지 않고,
   테스트 알림은 1분에 한 번, 지금 확인은 20초에 한 번만 눌립니다.
6. 대시보드의 **테스트 알림** 버튼으로 텔레그램이 오는지 확인.

**서버에 올리면 맥에서 돌리던 건 끄세요.** 둘 다 켜 두면 알림이 두 번 옵니다.

다른 선택지: Fly.io(비슷한 방식, `Dockerfile` 그대로 사용), 항상 켜 두는 미니 PC·라즈베리파이
(`python3 -m chmonitor --server`), 소형 VPS. GitHub Actions 예약 실행은 최소 5분 간격에 자주 늦어서 드롭용으로는 비추천.

## 설정 (`config.json`)

| 키 | 기본값 | 설명 |
|---|---|---|
| `stores` | 넷 다 켬 | `chromehearts`, `skylrk`, `cpfm`, `denimtears`. `{"cpfm": {"enabled": false}}`로 끄기. 스토어별로 아래 키를 덮어쓸 수 있음 |
| `preferred_sizes` | `[]` | 구매 링크에 미리 고를 사이즈 순서. `"L"`, `"LRG"` 둘 다 됨 |
| `alert_groups` | `["hoodie","top"]` | 알림 보낼 그룹 (후디·집업, 상의) |
| `keywords` | `[]` | 이 단어가 들어간 상품만 알림. 비우면 그룹 기준 |
| `interval_seconds` | 크롬하츠 60, SKYLRK·CPFM 45, Denim Tears 75 | 확인 간격(초), 최소 20. Denim Tears는 상품이 320개라 한 번에 약 2MB를 받아서 조금 느리게 |
| `track_stock` | `focus` | 크롬하츠 사이즈 재고 확인 범위: `focus`(후디+키워드) / `all` / `off`. SKYLRK는 항상 전체 |
| `auto_open_browser` | `true` | 알림과 함께 구매 페이지 열기 (서버 모드에선 꺼짐) |
| `usd_krw` / `usd_krw_fallback` | `null` / 1400 | 원화 환율 고정값 / 실시간 환율을 못 받을 때 값 |
| `telegram`, `ntfy`, `discord`, `desktop`, `sound` | | 알림 채널 |

환경변수: `CH_TELEGRAM_BOT_TOKEN`, `CH_TELEGRAM_CHAT_ID`, `CH_DISCORD_WEBHOOK_URL`, `CH_NTFY_TOPIC`,
`CH_CONFIG_JSON`(설정 전체), `CH_DATA_DIR`(상태 파일 폴더), `CH_DASHBOARD_REQUIRE_PASSWORD`·`CH_DASHBOARD_PASSWORD`(대시보드 잠금, 선택), `PORT`.

## 어떻게 감지하나

- **크롬하츠** (Salesforce Commerce Cloud): 전체 상품 그리드(`cgid=root`)를 12개씩 읽고, 사이트맵의 카테고리를 한 페이지씩
  확인합니다. hoodie·hat 같은 카테고리는 평소 닫혀 있다가(홈으로 리다이렉트) 드롭 때 열리므로 카테고리 오픈이 가장 빠른 신호인 경우가 많습니다.
  사이즈 재고는 `Product-Variation`으로 후디·새 상품만 확인합니다.
- **SKYLRK · CPFM · Denim Tears** (Shopify): `products.json`으로 전 상품과 사이즈별 재고가 오고(빈 페이지가 나올 때까지 읽음),
  `collections.json`으로 새 컬렉션(드롭)을 봅니다. 선호 사이즈 재고가 있으면 구매 버튼이 그 사이즈가 담긴 결제 화면으로 바로 갑니다.
- 요청 사이 0.5초 이상 쉬고, 실패가 이어지면 간격을 늘립니다(최대 10분). 3번 연속 실패하면 알립니다.

## 문제 해결

- **대시보드에 "이전 버전으로 실행 중" 경고**: `git pull` 뒤 예전 프로세스가 켜져 있는 경우. 그 터미널에서 Ctrl+C 후 다시 실행.
- **"포트 8787을 이미 쓰고 있습니다"**: `lsof -ti tcp:8787 | xargs kill` 후 다시 실행.
- **CERTIFICATE_VERIFY_FAILED**: python.org 파이썬이면 `open "/Applications/Python 3.13/Install Certificates.command"` 한 번.
- **No module named chmonitor**: `drop-monitor` 폴더 안에서 실행 (`cd ~/chusherlock/drop-monitor`).
- **텔레그램 `401 Unauthorized`**: 토큰이 틀림 → `--setup-telegram` 다시. **`400 chat not found`**: 봇에게 시작을 안 누름.

## 개발

```bash
python3 -m unittest discover -s tests -t .
python3 tools/build_dashboard.py   # tools/dashboard.tpl.html 을 고친 뒤 (로고를 페이지에 넣어 줌)
```

- `chmonitor/site.py` 크롬하츠, `shopify.py` SKYLRK, `stores.py` 스토어 목록
- `groups.py` 상품 그룹, `detect.py` 변화 감지, `notify.py` 한국어 알림, `telegram.py` 텔레그램
- `monitor.py` 감시 루프·명령줄, `dashboard.py` 대시보드 서버, `fx.py` 환율
