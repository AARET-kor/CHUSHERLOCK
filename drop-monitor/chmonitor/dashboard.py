"""Local dashboard: runs the monitor in a background thread and serves its state.

Listens on 127.0.0.1 only. The two actions (check now, test alert) are POSTs that
need a custom header, so another website open in the same browser cannot trigger
them (a cross-origin request with a custom header needs a CORS preflight, which
this server never approves).
"""

from __future__ import annotations

import json
import logging
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from . import fx
from .detect import Event
from .groups import LABELS, classify
from .monitor import Monitor, sample_event
from .site import Product

log = logging.getLogger("chmonitor")
PAGE = Path(__file__).with_name("dashboard.html")
STATIC = Path(__file__).with_name("static")
STATIC_FILES = {"banner.png", "cross.png", "favicon.png"}
ACTION_HEADER = "X-CH-Dashboard"


def config_summary(cfg: dict) -> dict:
    def on(name: str) -> bool:
        c = cfg.get(name)
        return bool(c.get("enabled")) if isinstance(c, dict) else bool(c)

    return {
        "interval_seconds": cfg["interval_seconds"],
        "keywords": cfg["keywords"],
        "preferred_sizes": cfg["preferred_sizes"],
        "track_stock": cfg["track_stock"],
        "alert_groups": cfg.get("alert_groups") or [],
        "auto_open_browser": bool(cfg.get("auto_open_browser")),
        "channels": {n: on(n) for n in ("desktop", "sound", "ntfy", "telegram", "discord")},
    }


def build_state(mon: Monitor) -> dict:
    snap = mon.snapshot()
    for d in snap["products"]:
        d["buy_url"] = mon.notifier.link(Event("view", "", product=Product.from_dict(d)))
        d["group"] = classify(d["name"], d["category"])
        d["price_krw"] = fx.krw(d["price"])
    snap["category_groups"] = {c: classify("", c) for c in snap["categories"]}
    snap["group_labels"] = LABELS
    snap["fx"] = fx.info()
    snap["config"] = config_summary(mon.cfg)
    return snap


def make_handler(mon: Monitor):
    class Handler(BaseHTTPRequestHandler):
        server_version = "chmonitor"

        def log_message(self, fmt, *args):  # keep the console for monitor logs
            log.debug("dashboard: " + fmt, *args)

        def _host_ok(self) -> bool:
            host = (self.headers.get("Host") or "").split(":")[0]
            return host in ("127.0.0.1", "localhost")  # blocks DNS rebinding

        def _send(self, code: int, body: bytes, ctype: str) -> None:
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)

        def _json(self, obj, code: int = 200) -> None:
            self._send(code, json.dumps(obj, ensure_ascii=False).encode("utf-8"), "application/json; charset=utf-8")

        def do_GET(self):
            if not self._host_ok():
                return self._json({"error": "forbidden host"}, 403)
            path = self.path.split("?")[0]
            if path in ("/", "/index.html"):
                return self._send(200, PAGE.read_bytes(), "text/html; charset=utf-8")
            if path.startswith("/static/") and path[8:] in STATIC_FILES:
                body = (STATIC / path[8:]).read_bytes()
                self.send_response(200)
                self.send_header("Content-Type", "image/png")
                self.send_header("Content-Length", str(len(body)))
                self.send_header("Cache-Control", "max-age=86400")
                self.end_headers()
                self.wfile.write(body)
                return
            if path == "/favicon.ico":
                return self._send(200, (STATIC / "favicon.png").read_bytes(), "image/png")
            if path == "/api/state":
                return self._json(build_state(mon))
            self._json({"error": "not found"}, 404)

        def do_POST(self):
            if not self._host_ok() or self.headers.get(ACTION_HEADER) != "1":
                return self._json({"error": "forbidden"}, 403)
            path = self.path.split("?")[0]
            if path == "/api/check":
                mon.request_check()
                return self._json({"ok": True})
            if path == "/api/test-notify":
                ev = sample_event()
                mon.record(ev)
                threading.Thread(target=mon.notifier.send, args=(ev,), daemon=True).start()
                return self._json({"ok": True})
            self._json({"error": "not found"}, 404)

    return Handler


def serve(mon: Monitor, port: int = 8787, open_browser: bool = True) -> int:
    stop = threading.Event()
    worker = threading.Thread(target=mon.loop, args=(stop,), name="monitor", daemon=True)
    worker.start()
    httpd = ThreadingHTTPServer(("127.0.0.1", port), make_handler(mon))
    url = f"http://127.0.0.1:{port}/"
    log.info("대시보드: %s", url)
    if open_browser:
        webbrowser.open(url)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n종료합니다.")
    finally:
        stop.set()
        mon.request_check()  # wake the loop so it sees stop
        httpd.server_close()
    return 0
