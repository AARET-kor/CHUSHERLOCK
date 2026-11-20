"""Polling loop and command line."""

from __future__ import annotations

import argparse
import json
import logging
import os
import random
import sys
import threading
import time
from pathlib import Path

from .detect import Event, diff_categories, diff_products, matches
from .notify import Notifier
from .site import Client, FetchError, Product, fetch_categories, fetch_category, fetch_stock

log = logging.getLogger("chmonitor")

DEFAULTS: dict = {
    "interval_seconds": 60,
    "keywords": [],              # empty = every product
    "preferred_sizes": [],       # e.g. ["LRG", "MED"]
    "categories": [],            # empty = read from sitemap
    "track_stock": "watchlist",  # watchlist | all | off
    "auto_open_browser": True,
    "auto_open_on": ["new_product", "relisted", "restock", "category_open"],
    "desktop": True,
    "sound": True,
    "ntfy": {"enabled": False, "topic": "", "server": "https://ntfy.sh", "priority": 5},
    "telegram": {"enabled": False, "bot_token": "", "chat_id": ""},
    "discord": {"enabled": False, "webhook_url": "", "mention_user_id": ""},
    "state_file": "state.json",
}
MIN_INTERVAL = 20
MAX_STOCK_CHECKS_PER_CYCLE = 25
MAX_EVENTS = 300


def now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S")


def sample_event() -> Event:
    p = Product(pid="176354XXXXXX349", name="CH LOGO SOCKS (테스트)", price="255.00",
                category="Socks", url="https://www.chromehearts.com/socks/ch-logo-socks/176354XXXXXX349.html",
                image="https://www.chromehearts.com/dw/image/v2/bfbv_prd/on/demandware.static/-/Sites-ch-master-catalog/default/dwef1672e7/img_products/hi-res/316176354BLKSML349-1.png?sw=600",
                sizes={"SML": True, "MED": True, "LRG": True},
                size_labels={"SML": "S", "MED": "M", "LRG": "L"})
    return Event("test", "테스트 알림: " + p.name, product=p, detail="$255.00 · Socks")


def load_config(path: str | None) -> dict:
    cfg = json.loads(json.dumps(DEFAULTS))
    if path and Path(path).exists():
        user = json.loads(Path(path).read_text(encoding="utf-8"))
        for k, v in user.items():
            if isinstance(v, dict) and isinstance(cfg.get(k), dict):
                cfg[k].update(v)
            else:
                cfg[k] = v
    # secrets may come from the environment instead of the file
    env = {
        ("telegram", "bot_token"): "CH_TELEGRAM_BOT_TOKEN",
        ("telegram", "chat_id"): "CH_TELEGRAM_CHAT_ID",
        ("discord", "webhook_url"): "CH_DISCORD_WEBHOOK_URL",
        ("ntfy", "topic"): "CH_NTFY_TOPIC",
    }
    for (sect, key), var in env.items():
        if os.environ.get(var):
            cfg[sect][key] = os.environ[var]
            cfg[sect]["enabled"] = True
    cfg["interval_seconds"] = max(MIN_INTERVAL, float(cfg["interval_seconds"]))
    return cfg


class State:
    def __init__(self, path: Path):
        self.path = path
        self.products: dict[str, Product] = {}
        self.categories: dict[str, int] = {}
        self.initialized = False
        self.events: list[dict] = []
        if path.exists():
            d = json.loads(path.read_text(encoding="utf-8"))
            self.products = {k: Product.from_dict(v) for k, v in d.get("products", {}).items()}
            self.categories = d.get("categories", {})
            self.initialized = bool(d.get("initialized"))
            self.events = d.get("events", [])

    def save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps({
            "initialized": self.initialized or bool(self.categories),
            "updated_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "categories": self.categories,
            "products": {k: v.to_dict() for k, v in self.products.items()},
            "events": self.events[-MAX_EVENTS:],
        }, ensure_ascii=False, indent=1), encoding="utf-8")
        tmp.replace(self.path)


class Monitor:
    def __init__(self, cfg: dict, client: Client | None = None, notifier: Notifier | None = None):
        self.cfg = cfg
        self.client = client or Client()
        self.notifier = notifier or Notifier(cfg)
        self.state = State(Path(cfg["state_file"]))
        self._cats: list[str] = []
        self._cycle = 0
        self.lock = threading.RLock()
        self._wake = threading.Event()
        self.status: dict = {"state": "starting", "checking": False, "last_check": None,
                             "last_ok": None, "last_error": None, "next_check": None,
                             "fails": 0, "cycles": 0, "started": now_iso()}

    def request_check(self) -> None:
        """Run the next check now instead of waiting for the interval."""
        self._wake.set()

    def snapshot(self) -> dict:
        with self.lock:
            return {
                "status": dict(self.status),
                "products": [p.to_dict() for p in self.state.products.values()],
                "categories": dict(self.state.categories),
                "events": list(self.state.events[-100:]),
            }

    def categories(self) -> list[str]:
        if self.cfg["categories"]:
            return [c for c in self.cfg["categories"] if c != "root"]
        if not self._cats or self._cycle % 30 == 0:  # refresh sitemap every ~30 cycles
            found = fetch_categories(self.client)
            if found:
                self._cats = found
        return [c for c in self._cats if c != "root"]

    # phase 1: the full catalogue (every listed product is in cgid=root)
    def scan_products(self) -> dict[str, Product]:
        old = self.state.products
        current = {p.pid: p for p in fetch_category(self.client, "root")}  # FetchError propagates
        if not current and old:
            raise FetchError("cgid=root", None, "상품 목록이 비어 있음 (점검 중이거나 차단됨)")
        products: dict[str, Product] = {}
        for pid, p in old.items():  # never forget a product; mark it delisted instead
            q = Product.from_dict(p.to_dict())
            q.listed = pid in current
            products[pid] = q
        for pid, p in current.items():
            prev = old.get(pid)
            if prev:
                p.sizes, p.size_labels, p.available = dict(prev.sizes), dict(prev.size_labels), prev.available
                p.first_seen = prev.first_seen
            p.first_seen = p.first_seen or now_iso()
            products[pid] = p
        self._check_stock(products, old)
        return products

    def _check_stock(self, products: dict[str, Product], old: dict[str, Product]) -> None:
        mode = self.cfg["track_stock"]
        kws = self.cfg["keywords"]
        baseline = not self.state.initialized
        todo = []
        for pid, p in products.items():
            if not p.listed:
                continue
            is_new = not baseline and (pid not in old or not old[pid].listed)
            watched = mode == "all" or (mode == "watchlist" and bool(kws) and matches(p, kws))
            if is_new or watched:
                todo.append(p)
        todo.sort(key=lambda p: (p.pid in old, p.pid))  # new products first
        for p in todo[:MAX_STOCK_CHECKS_PER_CYCLE]:
            try:
                p.available, p.sizes, p.size_labels = fetch_stock(self.client, p.pid)
            except (FetchError, ValueError) as e:
                log.debug("재고 조회 실패 %s: %s", p.pid, e)

    # phase 2: categories that are closed until a drop opens them
    def scan_categories(self) -> dict[str, int]:
        counts: dict[str, int] = {}
        for cg in self.categories():
            try:
                counts[cg] = len(fetch_category(self.client, cg, max_pages=1))
            except FetchError as e:
                log.warning("카테고리 %s 조회 실패: %s", cg, e)
                counts[cg] = self.state.categories.get(cg, 0)  # unknown: keep last value
        return counts

    def _emit(self, events: list[Event]) -> None:
        for ev in events:
            link = self.notifier.link(ev)
            log.info("🚨 %s  %s  %s", ev.title, ev.detail, link)
            self.record(ev, link)
            self.notifier.send(ev)

    def record(self, ev: Event, link: str = "") -> None:
        with self.lock:
            self.state.events.append({
                "time": now_iso(), "kind": ev.kind, "title": ev.title, "detail": ev.detail,
                "link": link or self.notifier.link(ev),
                "image": ev.product.image if ev.product else "",
                "pid": ev.product.pid if ev.product else "",
            })
            del self.state.events[:-MAX_EVENTS]

    def run_once(self) -> list[Event]:
        first = not self.state.initialized
        events: list[Event] = []

        products = self.scan_products()
        if not first:
            evs = diff_products(self.state.products, products, self.cfg["keywords"])
            self._emit(evs)  # alert before the slower category pass
            events += evs
        with self.lock:
            self.state.products = products
            self.state.save()

        counts = self.scan_categories()
        if not first:
            evs = diff_categories(self.state.categories, counts)
            self._emit(evs)
            events += evs
        else:
            listed = sum(1 for p in products.values() if p.listed)
            log.info("첫 실행: 상품 %d개, 카테고리 %d개를 기준으로 저장 (알림 없음)", listed, len(counts))
        with self.lock:
            self.state.categories = counts
            self.state.initialized = True
            self.state.save()
        self._cycle += 1
        return events

    def check(self) -> list[Event]:
        """run_once plus bookkeeping for the dashboard. Raises FetchError."""
        self.status.update(checking=True, state="checking", last_check=now_iso())
        try:
            evs = self.run_once()
        except FetchError as e:
            self.status.update(checking=False, state="error", last_error=str(e),
                               fails=self.status["fails"] + 1)
            raise
        self.status.update(checking=False, state="ok", last_ok=now_iso(), last_error=None,
                           fails=0, cycles=self.status["cycles"] + 1)
        return evs

    def loop(self, stop: threading.Event | None = None) -> None:
        base = self.cfg["interval_seconds"]
        stop = stop or threading.Event()
        log.info("모니터링 시작: %.0f초 간격, 키워드=%s", base, self.cfg["keywords"] or "전체")
        while not stop.is_set():
            self._wake.clear()
            try:
                evs = self.check()
                listed = sum(1 for p in self.state.products.values() if p.listed)
                log.info("확인 완료: 상품 %d개 · 변경 %d건", listed, len(evs))
                delay = base * random.uniform(0.8, 1.2)
            except FetchError as e:
                fails = self.status["fails"]
                delay = min(600, base * 2 ** (fails - 1))
                log.error("사이트 접속 실패 (%d회 연속): %s — %.0f초 후 재시도", fails, e, delay)
                if fails == 3:
                    ev = Event("error", "모니터 접속 실패",
                               detail="chromehearts.com에 3회 연속 접속하지 못했습니다.")
                    self.record(ev)
                    self.notifier.send(ev)
            except Exception:  # keep watching whatever happens
                log.exception("확인 중 예기치 않은 오류")
                self.status.update(checking=False, state="error", last_error="내부 오류 (로그 확인)")
                delay = base
            self.status["next_check"] = time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime(time.time() + delay))
            self._wake.wait(delay)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="chmonitor", description="Chrome Hearts 드롭 모니터")
    ap.add_argument("-c", "--config", default="config.json", help="설정 파일 (기본 config.json)")
    ap.add_argument("--once", action="store_true", help="한 번만 확인하고 종료")
    ap.add_argument("--list", action="store_true", help="현재 판매 중인 상품을 출력하고 종료")
    ap.add_argument("--test-notify", action="store_true", help="설정된 알림 채널로 테스트 알림 전송")
    ap.add_argument("--reset", action="store_true", help="저장된 상태를 지우고 새 기준으로 시작")
    ap.add_argument("--setup-telegram", action="store_true", help="텔레그램 봇 연결 (토큰 입력 → chat_id 자동 저장)")
    ap.add_argument("--dashboard", action="store_true", help="감시 + 로컬 대시보드 (http://127.0.0.1:8787)")
    ap.add_argument("--port", type=int, default=8787, help="대시보드 포트")
    ap.add_argument("--no-browser", action="store_true", help="대시보드를 브라우저로 자동으로 열지 않음")
    ap.add_argument("-v", "--verbose", action="store_true")
    args = ap.parse_args(argv)

    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO,
                        format="%(asctime)s %(message)s", datefmt="%H:%M:%S")
    if args.setup_telegram:
        from .telegram import setup
        return setup(args.config)

    cfg = load_config(args.config)

    if args.reset and Path(cfg["state_file"]).exists():
        Path(cfg["state_file"]).unlink()

    if args.test_notify:
        Notifier(cfg).send(sample_event())
        print("테스트 알림을 보냈습니다.")
        return 0

    if args.list:
        client = Client()
        items = fetch_category(client, "root")
        for p in sorted(items, key=lambda p: (p.category, p.name)):
            print(f"{p.category:<12} ${p.price:>9}  {p.name:<40} {p.url}")
        print(f"\n총 {len(items)}개")
        return 0

    mon = Monitor(cfg)
    if args.dashboard:
        from .dashboard import serve
        return serve(mon, args.port, open_browser=not args.no_browser)
    if args.once:
        mon.run_once()
        return 0
    try:
        mon.loop()
    except KeyboardInterrupt:
        print("\n종료합니다.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
