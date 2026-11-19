import json
import tempfile
import unittest
from pathlib import Path

from chmonitor.detect import diff_categories, diff_products
from chmonitor.monitor import Monitor, load_config
from chmonitor.notify import Notifier
from chmonitor.site import STORE, Product, buy_url, parse_categories, parse_grid, parse_variation

FIX = Path(__file__).parent / "fixtures"


def tile(pid, name="X", price="100.00", category="Hoodie"):
    return (f'<span class="product-metadata d-none" data-pid="{pid}" data-name="{name}" '
            f'data-price="{price}" data-category="{category}"></span>'
            f'<a href="/{category.lower()}/x/{pid}.html">x</a>')


class ParseTests(unittest.TestCase):
    def test_grid(self):
        items = parse_grid((FIX / "grid.html").read_text())
        self.assertEqual([p.pid for p in items], ["111111XXXXXX001", "222222XXXXXX002"])
        h = items[0]
        self.assertEqual(h.name, "CEMETERY HOODIE")
        self.assertEqual(h.price, "1,450.00")
        self.assertEqual(h.category, "Hoodie")
        self.assertEqual(h.url, "https://www.chromehearts.com/hoodie/cemetery-hoodie/111111XXXXXX001.html")
        self.assertTrue(h.image.endswith("111111-1.png?sw=600"))
        self.assertEqual(items[1].name, "+22+ Soap & Rope")

    def test_empty_grid(self):
        self.assertEqual(parse_grid(""), [])

    def test_sitemap(self):
        self.assertEqual(parse_categories((FIX / "sitemap.xml").read_text()), ["hoodie", "SWEATPANTS", "socks"])

    def test_variation(self):
        avail, sizes, labels = parse_variation(json.loads((FIX / "variation.json").read_text()))
        self.assertTrue(avail)
        self.assertEqual(sizes, {"SML": False, "MED": True, "LRG": True})
        self.assertEqual(labels["LRG"], "L")

    def test_buy_url(self):
        p = Product(pid="P1", name="n", url="https://www.chromehearts.com/a/P1.html")
        self.assertEqual(buy_url(p), p.url)
        self.assertEqual(buy_url(p, "LRG"), p.url + "?dwvar_P1_size=LRG&quantity=1")


class DiffTests(unittest.TestCase):
    def test_new_relisted_price_restock(self):
        old = {
            "A": Product("A", "Old", "10"),
            "B": Product("B", "Gone", "10", listed=False),
            "C": Product("C", "Hoodie", "10", sizes={"MED": False, "LRG": True}),
            "D": Product("D", "Pricey", "10"),
        }
        new = {
            "A": Product("A", "Old", "10"),
            "B": Product("B", "Gone", "10"),
            "C": Product("C", "Hoodie", "10", sizes={"MED": True, "LRG": True}, size_labels={"MED": "M"}),
            "D": Product("D", "Pricey", "12"),
            "E": Product("E", "Fresh", "10"),
        }
        kinds = {(e.kind, e.product.pid) for e in diff_products(old, new)}
        self.assertEqual(kinds, {("relisted", "B"), ("restock", "C"), ("price_change", "D"), ("new_product", "E")})
        restock = [e for e in diff_products(old, new) if e.kind == "restock"][0]
        self.assertEqual(restock.detail, "사이즈 M")

    def test_keywords_filter(self):
        new = {"E": Product("E", "CEMETERY HOODIE"), "F": Product("F", "Candle", category="Scents")}
        self.assertEqual([e.product.pid for e in diff_products({}, new, ["hoodie"])], ["E"])

    def test_delisted_products_are_silent(self):
        self.assertEqual(diff_products({"A": Product("A", "a")}, {"A": Product("A", "a", listed=False)}), [])

    def test_category_open(self):
        evs = diff_categories({"hoodie": 0, "socks": 6}, {"hoodie": 3, "socks": 6, "hat": 1})
        self.assertEqual(sorted(e.category for e in evs), ["hat", "hoodie"])


class FakeClient:
    """Serves canned pages keyed by cgid; records requests."""

    def __init__(self, grids, variations=None):
        self.grids = grids
        self.variations = variations or {}
        self.urls = []

    def get(self, url):
        self.urls.append(url)
        if "Search-UpdateGrid" in url:
            cg = url.split("cgid=")[1].split("&")[0]
            start = int(url.split("start=")[1].split("&")[0])
            return self.grids.get(cg, "") if start == 0 else ""
        if "Product-Variation" in url:
            pid = url.split("pid=")[1].split("&")[0]
            return json.dumps(self.variations.get(pid, {"product": {"available": True}}))
        if "sitemap" in url:
            return (FIX / "sitemap.xml").read_text()
        return ""


class RecordingNotifier(Notifier):
    def __init__(self, cfg):
        super().__init__(cfg)
        self.sent = []

    def send(self, ev):
        self.sent.append(ev)


class MonitorTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.cfg = load_config(None)
        self.cfg["state_file"] = str(Path(self.tmp.name) / "state.json")
        self.cfg["preferred_sizes"] = ["L"]

    def tearDown(self):
        self.tmp.cleanup()

    def make(self, client):
        n = RecordingNotifier(self.cfg)
        return Monitor(self.cfg, client=client, notifier=n), n

    def test_baseline_then_drop(self):
        client = FakeClient({"root": tile("A") + tile("B")})
        mon, n = self.make(client)
        self.assertEqual(mon.run_once(), [])  # first run: baseline only
        self.assertEqual(n.sent, [])

        # drop: new product C, hoodie category opens
        client.grids = {"root": tile("A") + tile("B") + tile("C", "CEMETERY HOODIE"), "hoodie": tile("C")}
        client.variations = {"C": json.loads((FIX / "variation.json").read_text())}
        mon2, n2 = self.make(client)  # new process reads saved state
        evs = mon2.run_once()
        self.assertEqual(sorted(e.kind for e in evs), ["category_open", "new_product"])
        new = [e for e in evs if e.kind == "new_product"][0]
        self.assertEqual(new.product.sizes["LRG"], True)
        self.assertIn("dwvar_C_size=LRG", n2.link(new))  # preferred size pre-selected
        self.assertEqual(len(n2.sent), 2)

        # nothing changes -> no alerts
        self.assertEqual(mon2.run_once(), [])

    def test_failed_category_does_not_fake_open(self):
        client = FakeClient({"root": tile("A"), "hoodie": tile("H")})
        mon, n = self.make(client)
        mon.run_once()
        orig = client.get

        def flaky(url):
            from chmonitor.site import FetchError
            if "cgid=hoodie" in url:
                raise FetchError(url, 503, "down")
            return orig(url)

        client.get = flaky
        self.assertEqual(mon.run_once(), [])
        client.get = orig
        self.assertEqual(mon.run_once(), [])  # hoodie had items before: not an "open"

    def test_empty_root_is_an_error_not_a_mass_delist(self):
        from chmonitor.site import FetchError
        client = FakeClient({"root": tile("A")})
        mon, n = self.make(client)
        mon.run_once()
        client.grids = {"root": ""}
        with self.assertRaises(FetchError):
            mon.run_once()
        client.grids = {"root": tile("A")}
        self.assertEqual(mon.run_once(), [])  # no bogus "relisted"


if __name__ == "__main__":
    unittest.main()
