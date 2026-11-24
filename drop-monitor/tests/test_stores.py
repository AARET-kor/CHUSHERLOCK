import base64
import json
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path

from chmonitor import fx
from chmonitor.dashboard import make_handler
from chmonitor.detect import Event
from chmonitor.monitor import Monitor, load_config, sample_event
from chmonitor.notify import Notifier
from chmonitor.shopify import buy_url, parse_products
from chmonitor.stores import STORES

fx.configure(fixed=1400)
FIX = Path(__file__).parent / "fixtures"
SKY = json.loads((FIX / "shopify_products.json").read_text())["products"]


class ShopifyTests(unittest.TestCase):
    def test_parse_sizes_and_stock(self):
        [p] = parse_products("https://skylrk.com", SKY[0], "skylrk")
        self.assertEqual((p.pid, p.name, p.price, p.category, p.store), ("101", "NO ZIP - DOTS", "240.00", "HOODIES", "skylrk"))
        self.assertEqual(p.sizes, {"S": True, "M": True, "L": False})
        self.assertEqual(p.url, "https://skylrk.com/products/reverse-no-zip-dots")
        self.assertIn("width=600", p.image)

    def test_one_product_per_colour(self):
        toy, ink = parse_products("https://skylrk.com", SKY[1], "skylrk")
        self.assertEqual((toy.pid, toy.name), ("102-toy", "MATTERDADDIES - TOY"))  # colour already in the title
        self.assertEqual((ink.pid, ink.name), ("102-ink", "MATTERDADDIES - TOY · INK"))
        self.assertEqual((toy.sizes, ink.sizes), ({"M 9 / W 10": False}, {"M 9 / W 10": True}))
        self.assertEqual(ink.size_variants["M 9 / W 10"], "2002")
        self.assertEqual(ink.url, "https://skylrk.com/products/matterdaddies-toy?variant=2002")

    def test_no_size_option(self):
        self.assertEqual(parse_products("https://skylrk.com", SKY[2], "skylrk")[0].sizes, {})

    def test_buy_link_goes_to_checkout_only_when_in_stock(self):
        [p] = parse_products("https://skylrk.com", SKY[0], "skylrk")
        self.assertEqual(buy_url("https://skylrk.com", p, "M"), "https://skylrk.com/cart/1002:1")
        self.assertEqual(buy_url("https://skylrk.com", p, "L"), p.url)


class FakeSkyClient:
    def __init__(self, products, collections=None):
        self.products, self.collections = products, collections or {}

    def get(self, url):
        if "/products.json" in url:
            return json.dumps({"products": self.products if "page=1" in url else []})
        if "/collections.json" in url:
            return json.dumps({"collections": [{"handle": h, "products_count": n} for h, n in self.collections.items()]})
        return ""


class Recorder(Notifier):
    def __init__(self, cfg):
        super().__init__(cfg)
        self.sent = []

    def send(self, ev):
        self.sent.append(ev)


class SkylrkMonitorTests(unittest.TestCase):
    def test_hoodie_drop_and_restock_alert_but_not_shoes(self):
        with tempfile.TemporaryDirectory() as d:
            cfg = load_config(None)
            cfg["state_file"] = str(Path(d) / "state.json")
            hoodie = json.loads(json.dumps(SKY[0]))
            client = FakeSkyClient([SKY[2]], {"nyc": 5})
            n = Recorder(cfg)
            Monitor(cfg, client=client, notifier=n, store="skylrk").run_once()  # baseline
            self.assertTrue((Path(d) / "state-skylrk.json").exists())
            # drop: hoodie + sneakers appear, a sneaker collection and a hoodie collection open
            client.products = [SKY[2], hoodie, SKY[1]]
            client.collections = {"nyc": 5, "sunken-sneaker-drop": 4, "winter-hoodie-drop": 3}
            evs = Monitor(cfg, client=client, notifier=n, store="skylrk").run_once()
            self.assertEqual(sorted((e.kind, e.product.name if e.product else e.category) for e in evs),
                             [("category_open", "winter-hoodie-drop"), ("new_product", "NO ZIP - DOTS")])
            # L comes back in stock
            hoodie["variants"][2]["available"] = True
            evs = Monitor(cfg, client=client, notifier=n, store="skylrk").run_once()
            self.assertEqual([(e.kind, e.info.get("sizes_back")) for e in evs], [("restock", ["L"])])


class KoreanMessageTests(unittest.TestCase):
    def test_hoodie_message(self):
        cfg = load_config(None)
        cfg["preferred_sizes"] = ["M"]
        n = Notifier(cfg)
        ev = sample_event("skylrk")
        ev.kind = "new_product"
        m = n.message(ev, n.link(ev))
        self.assertTrue(m.headline.startswith("🔥 [SKYLRK] 후디 신상품"))
        self.assertIn("💵 $240 (약 336,000원)", m.lines)
        self.assertIn("📏 재고 있음: S · M  (품절: L)", m.lines)
        self.assertEqual(m.buttons[0], ("🛒 M 사이즈 바로 결제", "https://skylrk.com/cart/45827209199795:1"))
        self.assertNotRegex(m.html(), r"[A-Za-z]{5,} (in stock|sold out)")

    def test_collection_open_message(self):
        n = Notifier(load_config(None))
        ev = Event("category_open", "컬렉션 오픈: winter-hoodie-drop (3개)", category="winter-hoodie-drop", store="skylrk")
        m = n.message(ev, n.link(ev))
        self.assertEqual(m.headline, "🔥 [SKYLRK] 새 컬렉션 오픈")
        self.assertEqual(m.buttons, [("🏬 SKYLRK 열기", "https://skylrk.com/collections/winter-hoodie-drop")])


class ServerModeTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        cfg = load_config(None)
        cfg["state_file"] = str(Path(self.tmp.name) / "state.json")
        self.mons = {
            "chromehearts": Monitor(cfg, client=FakeSkyClient([]), notifier=Recorder(cfg), store="chromehearts"),
            "skylrk": Monitor(cfg, client=FakeSkyClient([SKY[0]]), notifier=Recorder(cfg), store="skylrk"),
        }
        self.mons["skylrk"].check()
        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(self.mons, public=True, password="hunter2hunter2"))
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()
        self.base = f"http://127.0.0.1:{self.httpd.server_port}"

    def tearDown(self):
        self.httpd.shutdown()
        self.httpd.server_close()
        self.tmp.cleanup()

    def get(self, path, password=None, host=None):
        h = {}
        if password:
            h["Authorization"] = "Basic " + base64.b64encode(f"me:{password}".encode()).decode()
        if host:
            h["Host"] = host
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        try:
            with opener.open(urllib.request.Request(self.base + path, headers=h), timeout=5) as r:
                return r.status, r.read().decode()
        except urllib.error.HTTPError as e:
            return e.code, e.read().decode()

    def test_password_when_configured(self):
        self.assertEqual(self.get("/")[0], 401)
        self.assertEqual(self.get("/api/state", "wrong-password")[0], 401)
        self.assertEqual(self.get("/", "hunter2hunter2", host="monitor.up.railway.app")[0], 200)
        self.assertEqual(self.get("/healthz"), (200, "ok v14"))

    def test_actions_are_rate_limited(self):
        def post(path):
            opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
            h = {"X-CH-Dashboard": "1", "Authorization": "Basic " + base64.b64encode(b"me:hunter2hunter2").decode()}
            try:
                with opener.open(urllib.request.Request(self.base + path, data=b"", headers=h, method="POST"), timeout=5) as r:
                    return r.status
            except urllib.error.HTTPError as e:
                return e.code
        self.assertEqual(post("/api/test-notify?store=skylrk"), 200)
        self.assertEqual(post("/api/test-notify?store=skylrk"), 429)
        self.assertEqual(post("/api/check?store=skylrk"), 200)
        self.assertEqual(post("/api/check?store=skylrk"), 429)

    def test_store_switch(self):
        code, body = self.get("/api/state?store=skylrk", "hunter2hunter2")
        d = json.loads(body)
        self.assertEqual(d["store"], "skylrk")
        self.assertEqual(d["products"][0]["group"], "hoodie")
        self.assertEqual([s["id"] for s in d["stores"]], ["chromehearts", "skylrk"])
        self.assertEqual(json.loads(self.get("/api/state", "hunter2hunter2")[1])["store"], "chromehearts")


if __name__ == "__main__":
    unittest.main()
