import json
import tempfile
import unittest
from pathlib import Path

from chmonitor import fx
from chmonitor.hidden import HiddenLinks, handle_from
from chmonitor.monitor import Monitor, load_config
from chmonitor.notify import Notifier
from chmonitor.shopify import parse_product_js
from chmonitor.site import FetchError
from chmonitor.stores import STORES

fx.configure(fixed=1400)


def js(pid, handle, title, sizes, typ="HOODIES"):
    return {"id": pid, "handle": handle, "title": title, "type": typ, "price": 16000, "price_min": 16000,
            "available": any(sizes.values()), "featured_image": "//cdn.shopify.com/x.png?v=1",
            "options": [{"name": "Color", "position": 1, "values": ["SMUDGE"]},
                        {"name": "Size", "position": 2, "values": list(sizes)}],
            "variants": [{"id": pid * 10 + i, "option1": "SMUDGE", "option2": s, "available": ok, "price": 16000}
                         for i, (s, ok) in enumerate(sizes.items())]}


class FakeShop:
    """products.json lists `listed`; /products/<h>.js answers for `hidden` handles."""

    def __init__(self, listed=(), hidden=None, sitemap=()):
        self.listed, self.hidden, self.sitemap, self.urls = list(listed), dict(hidden or {}), list(sitemap), []

    def get(self, url):
        self.urls.append(url)
        if "/products.json" in url:
            return json.dumps({"products": self.listed if "page=1" in url else []})
        if "/collections.json" in url:
            return json.dumps({"collections": []})
        if url.endswith("/sitemap.xml"):
            return "<loc>https://skylrk.com/sitemap_products_1.xml?from=1</loc>"
        if "sitemap_products" in url:
            return "".join(f"<loc>https://skylrk.com/products/{h}</loc>" for h in self.sitemap)
        if url.endswith(".js"):
            h = url.rsplit("/", 1)[-1][:-3]
            if h in self.hidden:
                return json.dumps(self.hidden[h])
            raise FetchError(url, 404, "Not Found")
        return ""


class HiddenTests(unittest.TestCase):
    def test_handle_from(self):
        self.assertEqual(handle_from("https://skylrk.com/products/reverse-zip-hoodie-1?variant=3"), "reverse-zip-hoodie-1")
        self.assertEqual(handle_from(" zip-hoodie "), "zip-hoodie")
        self.assertIsNone(handle_from("../../etc/passwd"))
        self.assertIsNone(handle_from(""))

    def test_parse_js_prices_in_cents(self):
        p = parse_product_js("https://skylrk.com", js(7, "zip-hoodie", "ZIP HOODIE", {"M": True, "XL": False}), "skylrk")
        self.assertEqual((p.pid, p.price, p.category, p.url), ("7", "160.00", "HOODIES", "https://skylrk.com/products/zip-hoodie"))
        self.assertEqual(p.sizes, {"M": True, "XL": False})
        self.assertEqual(p.size_variants["M"], "70")
        self.assertTrue(p.image.startswith("https://cdn.shopify.com/"))

    def test_finds_guesses_sitemap_and_user_links(self):
        shop = FakeShop(hidden={"zip-hoodie": js(1, "zip-hoodie", "ZIP HOODIE", {"M": True}),
                                "secret-tee": js(2, "secret-tee", "SECRET TEE", {"M": True}, "TOPS"),
                                "from-insta": js(3, "from-insta", "INSTA HOODIE", {"L": True})},
                        sitemap=["secret-tee"])
        st = {}
        hl = HiddenLinks(STORES["skylrk"], st, guesses=True)
        hl.add_user("from-insta")
        found = {p.name for p in hl.scan(shop, [], per_check=40)}
        self.assertEqual(found, {"ZIP HOODIE", "SECRET TEE", "INSTA HOODIE"})
        self.assertIn("zip-hoodie", st["found"])

    def test_rotation_never_skips_a_guess(self):
        hidden = {h: js(i + 1, h, h.upper(), {"M": True}) for i, h in enumerate(
            ["hoodie", "zip-hoodie", "reverse-hoodie", "reverse-zip-hoodie", "reverse-zip-hoodie-1"])}
        shop = FakeShop(hidden=hidden)
        hl = HiddenLinks(STORES["skylrk"], {}, guesses=True)
        seen = set()
        for _ in range(3):
            seen |= {p.url.rsplit("/", 1)[-1] for p in hl.scan(shop, [], per_check=6)}
        self.assertEqual(seen, set(hidden))

    def test_monitor_alerts_for_hidden_hoodie_once(self):
        with tempfile.TemporaryDirectory() as d:
            cfg = load_config(None)
            cfg["state_file"] = str(Path(d) / "s.json")
            shop = FakeShop(listed=[])
            sent = []

            class N(Notifier):
                def send(self, ev):
                    sent.append(ev)

            Monitor(cfg, client=shop, notifier=N(cfg), store="skylrk").run_once()  # baseline
            shop.hidden["reverse-zip-hoodie"] = js(9, "reverse-zip-hoodie", "REVERSE ZIP HOODIE", {"M": True})
            mon = Monitor(cfg, client=shop, notifier=N(cfg), store="skylrk")
            for _ in range(30):  # guesses rotate; the hoodie name comes up within a few checks
                mon.run_once()
                if sent:
                    break
            self.assertEqual([e.product.name for e in sent], ["REVERSE ZIP HOODIE"])
            ev = sent[0]
            self.assertTrue(ev.product.hidden)
            m = Notifier(cfg).message(ev, Notifier(cfg).link(ev))
            self.assertIn("🔗 히든링크", m.headline)
            mon.run_once()  # found links are checked every time: no repeat alert, stays listed
            self.assertEqual(len(sent), 1)
            self.assertTrue(mon.state.products["9"].listed)


class HealthTests(unittest.TestCase):
    def test_telegram_failure_is_recorded(self):
        cfg = load_config(None)
        cfg["telegram"].update(enabled=True, bot_token="t", chat_id="1")
        cfg.update(desktop=False, sound=False, auto_open_browser=False)
        n = Notifier(cfg)

        def boom(m, link):
            raise RuntimeError("sendMessage: 400 Bad Request: chat not found")
        n._telegram = boom
        from chmonitor.monitor import sample_event
        n.send(sample_event("skylrk"))
        h = n.health["telegram"]
        self.assertEqual((h["ok"], h["failed"]), (False, 1))
        self.assertIn("chat not found", h["error"])


if __name__ == "__main__":
    unittest.main()
