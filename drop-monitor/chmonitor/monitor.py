"""Polling loop and command line."""

from __future__ import annotations

import argparse
import copy
import json
import logging
import os
import random
import sys
import threading
import time
from datetime import datetime, timedelta
from pathlib import Path

from . import fx, priority
from .detect import Event, diff_categories, diff_products, matches
from .groups import HOODIE, classify, expand
from .notify import Notifier
from .site import Client, FetchError, Product
from .stores import STORES, Store
from .stores import get as get_store

log = logging.getLogger("chmonitor")

DEFAULTS: dict = {
    "stores": {                      # per-store switches and overrides of any key below
        "chromehearts": {"enabled": True},
        "skylrk": {"enabled": True},
        "cpfm": {"enabled": True},
        "denimtears": {"enabled": True},
    },
    "interval_seconds": None,        # None = the store's default (Chrome Hearts 60, SKYLRK/CPFM 45, Denim Tears 75)
    "keywords": [],                  # empty = every product
    "preferred_sizes": [],           # e.g. ["L", "M"]
    "categories": [],                # Chrome Hearts: empty = read from sitemap
    "track_stock": "focus",          # Chrome Hearts restock checks: focus (hoodies + keywords) | all | off
    "alert_groups": ["hoodie", "top"],  # hoodie | top | apparel (bottoms, outerwear) | accessory | other
    "auto_open_browser": True,
    "auto_open_on": ["new_product", "relisted", "restock", "category_open"],
    "desktop": True,
    "sound": True,
    "ntfy": {"enabled": False, "topic": "", "server": "https://ntfy.sh", "priority": 5},
    "telegram": {"enabled": False, "bot_token": "", "chat_id": ""},
    "discord": {"enabled": False, "webhook_url": "", "mention_user_id": ""},
    "usd_krw": None,                 # fix the won rate (e.g. 1450); null = fetch the live rate
    "usd_krw_fallback": 1400,        # used until a live rate arrives
    "hidden_links": True,            # Shopify stores: also watch products reachable only by direct link
    "hidden_per_check": 14,          # guessed links to try per check (SKYLRK): 2/3 hoodie names, 1/3 colours + others
    "priority": None,                # None = Chrome Hearts hoodies in M or XL (see priority.py); [] turns it off
    "state_file": "state.json",      # Chrome Hearts; other stores use state-<store>.json next to it
}
MIN_INTERVAL = 20
MAX_STOCK_CHECKS_PER_CYCLE = 25
MAX_EVENTS = 300
SCHEMA = 2  # 2: Shopify products are one entry per colour


def now_iso(offset: float = 0) -> str:
    """Local time with its UTC offset, so a browser in another zone reads it right."""
    return (datetime.now().astimezone() + timedelta(seconds=offset)).isoformat(timespec="seconds")


def _merge(base: dict, over: dict) -> None:
    for k, v in over.items():
        if isinstance(v, dict) and isinstance(base.get(k), dict):
            _merge(base[k], v)
        else:
            base[k] = v


def load_config(path: str | None) -> dict:
    cfg = copy.deepcopy(DEFAULTS)
    if path and Path(path).exists():
        _merge(cfg, json.loads(Path(path).read_text(encoding="utf-8")))
    if os.environ.get("CH_CONFIG_JSON"):  # whole config in one variable (servers)
        _merge(cfg, json.loads(os.environ["CH_CONFIG_JSON"]))
    # secrets may come from the environment instead of the file
    env = {
        ("telegram", "bot_token"): "CH_TELEGRAM_BOT_TOKEN",
        ("telegram", "chat_id"): "CH_TELEGRAM_CHAT_ID",
        ("discord", "webhook_url"): "CH_DISCORD_WEBHOOK_URL",
        ("ntfy", "topic"): "CH_NTFY_TOPIC",
    }
    for (sect, key), var in env.items():
        if os.environ.get(var):
            cfg[sect][key] = os.environ[var].strip()
            cfg[sect]["enabled"] = True
    if os.environ.get("CH_DATA_DIR"):
        cfg["state_file"] = str(Path(os.environ["CH_DATA_DIR"]) / Path(cfg["state_file"]).name)
    cfg["alert_groups"] = expand(cfg["alert_groups"])
    return cfg


def store_config(cfg: dict, store: Store) -> dict:
    """Global settings with the store's overrides applied."""
    c = copy.deepcopy({k: v for k, v in cfg.items() if k != "stores"})
    _merge(c, {k: v for k, v in (cfg.get("stores", {}).get(store.id) or {}).items() if k != "enabled"})
    c["alert_groups"] = expand(c["alert_groups"])
    c["interval_seconds"] = max(MIN_INTERVAL, float(c.get("interval_seconds") or store.default_interval))
    if store.id != "chromehearts":
        c["state_file"] = str(Path(c["state_file"]).with_name(f"state-{store.id}.json"))
    return c


def enabled_stores(cfg: dict, only: list[str] | None = None) -> list[Store]:
    out = []
    for sid, store in STORES.items():
        if only and sid not in only:
            continue
        if (cfg.get("stores", {}).get(sid) or {}).get("enabled", True):
            out.append(store)
    return out


def sample_event(store_id: str = "chromehearts") -> Event:
    if store_id == "skylrk":
        p = Product(pid="test-skylrk", name="NO ZIP - DOTS (테스트)", price="240.00", category="HOODIES",
                    url="https://skylrk.com/products/reverse-no-zip-dots",
                    image="https://cdn.shopify.com/s/files/1/0631/8214/3667/files/NOZIPHOODIE_DOTS_FRONT.png?width=600",
                    sizes={"S": True, "M": True, "L": False}, size_labels={"S": "S", "M": "M", "L": "L"},
                    size_variants={"S": "45827209167027", "M": "45827209199795", "L": "45827209232563"},
                    store="skylrk")
    else:
        p = Product(pid="176354XXXXXX349", name="CH LOGO SOCKS (테스트)", price="255.00",
                    category="Socks", url="https://www.chromehearts.com/socks/ch-logo-socks/176354XXXXXX349.html",
                    image="https://www.chromehearts.com/dw/image/v2/bfbv_prd/on/demandware.static/-/Sites-ch-master-catalog/default/dwef1672e7/img_products/hi-res/316176354BLKSML349-1.png?sw=600",
                    sizes={"SML": True, "MED": True, "LRG": True},
                    size_labels={"SML": "S", "MED": "M", "LRG": "L"})
    return Event("test", "테스트 알림: " + p.name, product=p, detail=fx.fmt(p.price))


class State:
    def __init__(self, path: Path):
        self.path = path
        self.products: dict[str, Product] = {}
        self.categories: dict[str, int] = {}
        self.initialized = False
        self.events: list[dict] = []
        self.hidden: dict = {}
        self.schema = SCHEMA
        if path.exists():
            d = json.loads(path.read_text(encoding="utf-8"))
            self.products = {k: Product.from_dict(v) for k, v in d.get("products", {}).items()}
            self.categories = d.get("categories", {})
            self.initialized = bool(d.get("initialized"))
            self.events = d.get("events", [])
            self.hidden = d.get("hidden", {})
            self.schema = d.get("schema", 1)

    def save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps({
            "initialized": self.initialized or bool(self.categories),
            "updated_at": now_iso(),
            "categories": self.categories,
            "products": {k: v.to_dict() for k, v in self.products.items()},
            "events": self.events[-MAX_EVENTS:],
            "hidden": self.hidden,
            "schema": self.schema,
        }, ensure_ascii=False, indent=1), encoding="utf-8")
        tmp.replace(self.path)


class Monitor:
    def __init__(self, cfg: dict, client: Client | None = None, notifier: Notifier | None = None,
                 store: Store | str | None = None):
        self.store = get_store(store) if isinstance(store, str) or store is None else store
        self.cfg = store_config(cfg, self.store)
        fx.configure(fallback=self.cfg.get("usd_krw_fallback"), fixed=self.cfg.get("usd_krw"))
        self.client = client or Client()
        self.notifier = notifier or Notifier(self.cfg)
        self.state = State(Path(self.cfg["state_file"]))
        # product ids changed shape (one per colour): take a fresh baseline instead of alerting on every colour
        self.rebaseline = self.store.stock_in_listing and self.state.initialized and self.state.schema < SCHEMA
        if self.rebaseline:
            self.state.products = {}
        self.hidden = None
        if self.cfg.get("hidden_links", True):
            if self.store.stock_in_listing:  # Shopify stores
                from .hidden import HiddenLinks
                self.hidden = HiddenLinks(self.store, self.state.hidden, guesses=self.store.id == "skylrk")
            elif self.store.id == "chromehearts":
                from .ch_hidden import ChromeHeartsHidden
                self.hidden = ChromeHeartsHidden(self.store, self.state.hidden, lambda: self.state.products)
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
                "store": self.store.id,
                "status": dict(self.status),
                "products": [p.to_dict() for p in self.state.products.values()],
                "categories": dict(self.state.categories),
                "events": list(self.state.events[-100:]),
            }

    def categories(self) -> list[str]:
        if self.cfg.get("categories"):
            return [c for c in self.cfg["categories"] if c != "root"]
        if not self._cats or self._cycle % 30 == 0:  # refresh the list every ~30 checks
            found = self.store.discover_categories(self.client)
            if found:
                self._cats = found
        return [c for c in self._cats if c != "root"]

    # phase 1: the whole catalogue
    def scan_products(self) -> dict[str, Product]:
        old = self.state.products
        current = {p.pid: p for p in self.store.products(self.client)}  # FetchError propagates
        if not current and any(p.listed and not p.hidden for p in old.values()):
            raise FetchError(self.store.base, None, "상품 목록이 비어 있음 (점검 중이거나 차단됨)")
        if self.hidden:
            per = int(self.cfg.get("hidden_per_check", 14)) if self.store.stock_in_listing else 8
            for p in self.hidden.scan(self.client, list(current.values()), per):
                current.setdefault(p.pid, p)
        products: dict[str, Product] = {}
        for pid, p in old.items():  # never forget a product; mark it delisted instead
            q = Product.from_dict(p.to_dict())
            q.listed = pid in current
            products[pid] = q
        for pid, p in current.items():
            prev = old.get(pid)
            if prev:
                if not self.store.stock_in_listing:  # keep the last stock check
                    p.sizes, p.size_labels, p.available = dict(prev.sizes), dict(prev.size_labels), prev.available
                p.first_seen = prev.first_seen
            p.first_seen = p.first_seen or now_iso()
            products[pid] = p
        if not self.store.stock_in_listing:
            self._check_stock(products, old)
        return products

    def _check_stock(self, products: dict[str, Product], old: dict[str, Product]) -> None:
        mode = self.cfg.get("track_stock", "focus")
        kws = self.cfg.get("keywords") or []
        baseline = not self.state.initialized
        todo = []
        for pid, p in products.items():
            if not p.listed or mode == "off":
                continue
            is_new = not baseline and (pid not in old or not old[pid].listed)
            focus = classify(p.name, p.category) == HOODIE or (bool(kws) and matches(p, kws))
            watched = mode == "all" or (mode in ("focus", "watchlist") and focus)
            if is_new or watched:
                todo.append(p)
        todo.sort(key=lambda p: (p.pid in old, p.pid))  # new products first
        for p in todo[:MAX_STOCK_CHECKS_PER_CYCLE]:
            try:
                p.available, p.sizes, p.size_labels = self.store.stock(self.client, p.pid)
            except (FetchError, ValueError, TypeError) as e:
                log.debug("재고 조회 실패 %s: %s", p.pid, e)

    # phase 2: categories / collections, which open when a drop goes live
    def scan_categories(self) -> dict[str, int]:
        prev = self.state.categories
        if self.store.id == "chromehearts":
            counts: dict[str, int] = {}
            for cg in self.categories():
                try:
                    counts.update(self.store.category_counts(self.client, [cg]))
                except FetchError as e:
                    log.warning("[%s] 카테고리 %s 조회 실패: %s", self.store.name, cg, e)
                    counts[cg] = prev.get(cg, 0)  # unknown: keep last value
            return counts
        try:
            return self.store.category_counts(self.client, [])
        except FetchError as e:
            log.warning("[%s] 컬렉션 조회 실패: %s", self.store.name, e)
            return dict(prev)

    def wanted(self, ev: Event) -> bool:
        """Alert only for the product groups in alert_groups."""
        groups = self.cfg.get("alert_groups") or ["hoodie", "apparel", "accessory", "other"]
        if ev.product:
            return classify(ev.product.name, ev.product.category) in groups
        if ev.kind == "category_open":
            return classify(self.store.category_title(ev.category), "") in groups
        return True

    def rules(self) -> list[dict]:
        r = self.cfg.get("priority")
        return priority.DEFAULT_RULES if r is None else r

    def _emit(self, events: list[Event]) -> None:
        for ev in events:
            ev.store = ev.store or self.store.id
            if priority.mark(ev, self.rules(), self.store.id):
                ev.title = f"⚡ {', '.join(ev.info['hits'])} 재고 — " + ev.title
            link = self.notifier.link(ev)
            log.info("🚨 [%s] %s  %s  %s", self.store.name, ev.title, ev.detail, link)
            self.record(ev, link)
            self.notifier.send(ev)

    def record(self, ev: Event, link: str = "") -> None:
        with self.lock:
            self.state.events.append({
                "time": now_iso(), "kind": ev.kind, "title": ev.title, "detail": ev.detail,
                "link": link or self.notifier.link(ev),
                "image": ev.product.image if ev.product else "",
                "pid": ev.product.pid if ev.product else "",
                "category": ev.category,
                "priority": bool(ev.info.get("priority")),
            })
            del self.state.events[:-MAX_EVENTS]

    def run_once(self) -> list[Event]:
        if not self.cfg.get("usd_krw") and self.cfg.get("fetch_fx", True):
            fx.refresh()
        first = not self.state.initialized or self.rebaseline
        events: list[Event] = []

        products = self.scan_products()
        if not first:
            evs = [e for e in diff_products(self.state.products, products, self.cfg.get("keywords")) if self.wanted(e)]
            self._emit(evs)  # alert before the slower category pass
            events += evs
        with self.lock:
            self.state.products = products
            self.state.save()

        counts = self.scan_categories()
        if not first:
            evs = [e for e in diff_categories(self.state.categories, counts, self.store.id, self.store.category_word)
                   if self.wanted(e)]
            self._emit(evs)
            events += evs
        else:
            listed = sum(1 for p in products.values() if p.listed)
            log.info("[%s] 첫 실행: 상품 %d개, %s %d개를 기준으로 저장 (알림 없음)",
                     self.store.name, listed, self.store.category_word, len(counts))
        with self.lock:
            self.state.categories = counts
            self.state.initialized = True
            self.state.schema = SCHEMA
            self.rebaseline = False
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
        log.info("[%s] 감시 시작: %.0f초 간격, 알림 대상=%s", self.store.name, base, ",".join(self.cfg["alert_groups"]))
        while not stop.is_set():
            self._wake.clear()
            try:
                evs = self.check()
                listed = sum(1 for p in self.state.products.values() if p.listed)
                log.info("[%s] 확인 완료: 상품 %d개 · 변경 %d건", self.store.name, listed, len(evs))
                delay = base * random.uniform(0.8, 1.2)
            except FetchError as e:
                fails = self.status["fails"]
                delay = min(600, base * 2 ** (fails - 1))
                log.error("[%s] 접속 실패 (%d회 연속): %s — %.0f초 후 재시도", self.store.name, fails, e, delay)
                if fails == 3:
                    ev = Event("error", "모니터 접속 실패", store=self.store.id,
                               detail=f"{self.store.name}에 3회 연속 접속하지 못했습니다.")
                    self.record(ev)
                    self.notifier.send(ev)
            except Exception:  # keep watching whatever happens
                log.exception("[%s] 확인 중 예기치 않은 오류", self.store.name)
                self.status.update(checking=False, state="error", last_error="내부 오류 (로그 확인)")
                delay = base
            self.status["next_check"] = now_iso(delay)
            self._wake.wait(delay)


def build_monitors(cfg: dict, only: list[str] | None = None) -> dict[str, Monitor]:
    notifier = Notifier(cfg)
    return {s.id: Monitor(cfg, notifier=notifier, store=s) for s in enabled_stores(cfg, only)}


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="chmonitor", description="Chrome Hearts · SKYLRK 드롭 모니터")
    ap.add_argument("-c", "--config", default="config.json", help="설정 파일 (기본 config.json)")
    ap.add_argument("--store", action="append", choices=sorted(STORES), help="이 스토어만 (여러 번 가능)")
    ap.add_argument("--once", action="store_true", help="한 번만 확인하고 종료")
    ap.add_argument("--list", action="store_true", help="현재 판매 중인 상품을 출력하고 종료")
    ap.add_argument("--test-notify", action="store_true", help="설정된 알림 채널로 테스트 알림 전송")
    ap.add_argument("--reset", action="store_true", help="저장된 상태를 지우고 새 기준으로 시작")
    ap.add_argument("--setup-telegram", action="store_true", help="텔레그램 봇 연결 (토큰 입력 → chat_id 자동 저장)")
    ap.add_argument("--dashboard", action="store_true", help="감시 + 로컬 대시보드 (http://127.0.0.1:8787)")
    ap.add_argument("--server", action="store_true",
                    help="서버용: 모든 주소에서 접속, $PORT 사용, 비밀번호(CH_DASHBOARD_PASSWORD) 필수, 데스크톱 알림 끔")
    ap.add_argument("--port", type=int, default=None, help="대시보드 포트 (기본 8787, 서버는 $PORT)")
    ap.add_argument("--no-browser", action="store_true", help="대시보드를 브라우저로 자동으로 열지 않음")
    ap.add_argument("-v", "--verbose", action="store_true")
    args = ap.parse_args(argv)

    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO,
                        format="%(asctime)s %(message)s", datefmt="%H:%M:%S")

    if args.setup_telegram:
        from .telegram import setup
        return setup(args.config)

    cfg = load_config(args.config)
    if args.server:  # nobody is sitting at a server: no desktop popups or browser tabs
        cfg.update(desktop=False, sound=False, auto_open_browser=False)

    if args.reset:
        for s in enabled_stores(cfg, args.store):
            f = Path(store_config(cfg, s)["state_file"])
            if f.exists():
                f.unlink()

    if args.test_notify:
        n = Notifier(cfg)
        for s in enabled_stores(cfg, args.store):
            n.send(sample_event(s.id))
        print("테스트 알림을 보냈습니다.")
        return 0

    if args.list:
        fx.configure(fallback=cfg.get("usd_krw_fallback"), fixed=cfg.get("usd_krw"))
        if not cfg.get("usd_krw"):
            fx.refresh()
        client = Client()
        for s in enabled_stores(cfg, args.store):
            items = s.products(client)
            print(f"\n■ {s.name} — {len(items)}개")
            for p in sorted(items, key=lambda p: (classify(p.name, p.category), p.category, p.name)):
                print(f"  {classify(p.name, p.category):<9} {p.category:<12} {fx.fmt(p.price):>26}  {p.name:<38} {p.url}")
        return 0

    monitors = build_monitors(cfg, args.store)
    if not monitors:
        print("켜진 스토어가 없습니다 (config의 stores 확인).")
        return 1
    if args.dashboard or args.server:
        from .dashboard import serve
        port = args.port or (int(os.environ.get("PORT", 8787)) if args.server else 8787)
        return serve(monitors, port, open_browser=not (args.no_browser or args.server), public=args.server)
    if args.once:
        for m in monitors.values():
            m.run_once()
        return 0
    stop = threading.Event()
    threads = [threading.Thread(target=m.loop, args=(stop,), daemon=True) for m in monitors.values()]
    for t in threads:
        t.start()
    try:
        while any(t.is_alive() for t in threads):
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n종료합니다.")
        stop.set()
    return 0


if __name__ == "__main__":
    sys.exit(main())
