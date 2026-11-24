"""Dashboard: runs one monitor per store in background threads and serves their state.

Local mode (--dashboard) listens on 127.0.0.1 only and checks the Host header
(no DNS rebinding). Server mode (--server) listens on every address with no
password by default; set CH_DASHBOARD_REQUIRE_PASSWORD=1 and
CH_DASHBOARD_PASSWORD to put HTTP Basic auth back on every page. The pages
never carry secrets (tokens stay on the server), and the two actions are
rate-limited so an open dashboard can't be used to spam Telegram.

The two actions (check now, test alert) are POSTs that need a custom header,
so another website open in the same browser cannot trigger them (a
cross-origin request with a custom header needs a CORS preflight, which this
server never approves).
"""

from __future__ import annotations

import base64
import hmac
import json
import logging
import os
import threading
import time
import urllib.parse
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from . import fx, priority
from .detect import Event
from .groups import LABELS, ORDER, classify, ko_category
from .monitor import Monitor, sample_event
from .site import Product

log = logging.getLogger("chmonitor")
PAGE = Path(__file__).with_name("dashboard.html")
ACTION_HEADER = "X-CH-Dashboard"
ACTION_GAP = {"/api/check": 20, "/api/test-notify": 60, "/api/hidden": 3}  # seconds between presses, per store


class Limiter:
    def __init__(self):
        self.last: dict[str, float] = {}
        self.lock = threading.Lock()

    def wait(self, key: str, gap: float) -> float:
        """0 and records the press when allowed, else the seconds left."""
        now = time.monotonic()
        with self.lock:
            left = self.last.get(key, -1e9) + gap - now
            if left > 0:
                return left
            self.last[key] = now
            return 0.0
VERSION = 11  # the page warns when an older server is still running


def config_summary(cfg: dict) -> dict:
    def on(name: str) -> bool:
        c = cfg.get(name)
        return bool(c.get("enabled")) if isinstance(c, dict) else bool(c)

    return {
        "interval_seconds": cfg["interval_seconds"],
        "keywords": cfg.get("keywords") or [],
        "preferred_sizes": cfg.get("preferred_sizes") or [],
        "alert_groups": cfg.get("alert_groups") or [],
        "auto_open_browser": bool(cfg.get("auto_open_browser")),
        "channels": {n: on(n) for n in ("desktop", "sound", "ntfy", "telegram", "discord")},
    }


def store_summary(mon: Monitor) -> dict:
    snap = mon.snapshot()
    listed = [p for p in snap["products"] if p["listed"]]
    return {
        "id": mon.store.id, "name": mon.store.name,
        "hoodies": sum(1 for p in listed if classify(p["name"], p["category"]) == "hoodie"),
        "listed": len(listed), "events": len(snap["events"]),
        "state": "checking" if snap["status"]["checking"] else snap["status"]["state"],
    }


def build_state(mon: Monitor, monitors: dict[str, Monitor]) -> dict:
    snap = mon.snapshot()
    for d in snap["products"]:
        p = Product.from_dict(d)
        d["buy_url"] = mon.notifier.link(Event("view", "", product=p, store=mon.store.id))
        d["group"] = classify(d["name"], d["category"])
        d["category_ko"] = ko_category(d["category"])
        d["price_krw"] = fx.krw(d["price"])
        d["priority_hits"] = priority.live_hits(p, mon.rules(), mon.store.id)
    titles = {c: mon.store.category_title(c) for c in snap["categories"]}
    snap["category_titles"] = titles
    snap["category_groups"] = {c: classify(titles[c]) for c in snap["categories"]}
    snap["category_urls"] = {c: mon.store.category_url(c) for c in snap["categories"]}
    snap["category_word"] = mon.store.category_word
    snap["store_url"] = mon.store.base
    snap["group_labels"] = LABELS
    snap["group_order"] = ORDER
    snap["fx"] = fx.info()
    snap["version"] = VERSION
    snap["notify_health"] = dict(mon.notifier.health)
    snap["hidden"] = ({"found": list(mon.hidden.state["found"]), "user": list(mon.hidden.state["user"]),
                       "live": mon.hidden.state.get("live", 0), "archive": len(mon.hidden.state.get("archive", [])),
                       "archive_note": mon.hidden.state.get("archive_note", ""),
                       "id_based": mon.store.id == "chromehearts"}
                      if mon.hidden else None)
    snap["config"] = config_summary(mon.cfg)
    snap["config"]["priority"] = [r for r in mon.rules() if r.get("store", mon.store.id) == mon.store.id]
    snap["stores"] = [store_summary(m) for m in monitors.values()]
    return snap


def make_handler(monitors: dict[str, Monitor], public: bool = False, password: str = ""):
    default = next(iter(monitors))
    limiter = Limiter()

    class Handler(BaseHTTPRequestHandler):
        server_version = "chmonitor"

        def log_message(self, fmt, *args):  # keep the console for monitor logs
            log.debug("dashboard: " + fmt, *args)

        def _host_ok(self) -> bool:
            if public:
                return True
            host = (self.headers.get("Host") or "").split(":")[0]
            return host in ("127.0.0.1", "localhost")  # blocks DNS rebinding

        def _auth_ok(self) -> bool:
            if not password:
                return True
            h = self.headers.get("Authorization") or ""
            if not h.startswith("Basic "):
                return False
            try:
                _, _, given = base64.b64decode(h[6:]).decode("utf-8").partition(":")
            except ValueError:
                return False
            return hmac.compare_digest(given.encode(), password.encode())

        def _send(self, code: int, body: bytes, ctype: str, extra: dict | None = None) -> None:
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Frame-Options", "DENY")
            for k, v in (extra or {}).items():
                self.send_header(k, v)
            self.end_headers()
            self.wfile.write(body)

        def _json(self, obj, code: int = 200) -> None:
            self._send(code, json.dumps(obj, ensure_ascii=False).encode("utf-8"), "application/json; charset=utf-8")

        def _guard(self) -> bool:
            if not self._host_ok():
                self._json({"error": "forbidden host"}, 403)
                return False
            if not self._auth_ok():
                self._send(401, "비밀번호가 필요합니다".encode(), "text/plain; charset=utf-8",
                           {"WWW-Authenticate": 'Basic realm="Drop Monitor", charset="UTF-8"'})
                return False
            return True

        def _mon(self) -> Monitor:
            q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            return monitors.get((q.get("store") or [default])[0]) or monitors[default]

        def do_GET(self):
            path = urllib.parse.urlparse(self.path).path
            if path == "/healthz":  # for the hosting platform's health check
                return self._send(200, f"ok v{VERSION}".encode(), "text/plain")
            if not self._guard():
                return
            if path in ("/", "/index.html"):
                return self._send(200, PAGE.read_bytes(), "text/html; charset=utf-8")
            if path == "/api/state":
                return self._json(build_state(self._mon(), monitors))
            self._json({"error": "not found"}, 404)

        def do_POST(self):
            if not self._guard():
                return
            if self.headers.get(ACTION_HEADER) != "1":
                return self._json({"error": "forbidden"}, 403)
            path = urllib.parse.urlparse(self.path).path
            mon = self._mon()
            wait = limiter.wait(f"{path}:{mon.store.id}", ACTION_GAP.get(path, 0))
            if wait:
                return self._json({"error": "too soon", "retry_after": round(wait)}, 429)
            if path == "/api/check":
                mon.request_check()
                return self._json({"ok": True})
            if path == "/api/hidden":
                if not mon.hidden:
                    return self._json({"error": "이 스토어는 히든링크를 지원하지 않습니다"}, 400)
                from .ch_hidden import pid_from
                from .hidden import handle_from
                try:
                    n = min(int(self.headers.get("Content-Length") or 0), 2000)
                    body = json.loads(self.rfile.read(n) or b"{}")
                except ValueError:
                    return self._json({"error": "bad request"}, 400)
                raw = str(body.get("link", ""))
                handle = pid_from(raw) if mon.store.id == "chromehearts" else handle_from(raw)
                if not handle:
                    return self._json({"error": "주소나 제품명을 알아볼 수 없습니다"}, 400)
                with mon.lock:
                    added = mon.hidden.add_user(handle)
                    mon.state.save()
                mon.request_check()
                return self._json({"ok": True, "handle": handle, "added": added})
            if path == "/api/test-notify":
                ev = sample_event(mon.store.id)
                mon.record(ev)
                threading.Thread(target=mon.notifier.send, args=(ev,), daemon=True).start()
                return self._json({"ok": True})
            self._json({"error": "not found"}, 404)

    return Handler


def serve(monitors: dict[str, Monitor] | Monitor, port: int = 8787, open_browser: bool = True,
          public: bool = False) -> int:
    if isinstance(monitors, Monitor):
        monitors = {monitors.store.id: monitors}
    password = ""
    if os.environ.get("CH_DASHBOARD_REQUIRE_PASSWORD", "").strip() in ("1", "true", "yes"):
        password = os.environ.get("CH_DASHBOARD_PASSWORD", "").strip()
        if len(password) < 8:
            print("CH_DASHBOARD_REQUIRE_PASSWORD 가 켜져 있으면 CH_DASHBOARD_PASSWORD 에 8자 이상이 필요합니다.")
            return 2
    host = "0.0.0.0" if public else "127.0.0.1"
    try:
        httpd = ThreadingHTTPServer((host, port), make_handler(monitors, public, password))
    except OSError:
        print(f"포트 {port}을(를) 이미 쓰고 있습니다. 이전에 켠 대시보드가 아직 실행 중이면 그 터미널에서 Ctrl+C로 끄거나,\n"
              f"  lsof -ti tcp:{port} | xargs kill\n로 끈 뒤 다시 실행하세요. (다른 포트: --port 8788)")
        return 1
    stop = threading.Event()
    for m in monitors.values():
        threading.Thread(target=m.loop, args=(stop,), name=f"monitor-{m.store.id}", daemon=True).start()
    url = f"http://127.0.0.1:{port}/"
    log.info("대시보드: %s%s", url if not public else f"0.0.0.0:{port}", " (비밀번호 보호)" if password else "")
    if open_browser:
        webbrowser.open(url)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n종료합니다.")
    finally:
        stop.set()
        for m in monitors.values():
            m.request_check()  # wake the loops so they see stop
        httpd.server_close()
    return 0
