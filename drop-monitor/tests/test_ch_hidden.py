import json
import tempfile
import unittest
from pathlib import Path

from chmonitor import fx
from chmonitor.ch_hidden import ChromeHeartsHidden, parse_archive, pid_from, product_from
from chmonitor.monitor import Monitor, load_config
from chmonitor.notify import Notifier
from chmonitor.site import FetchError
from chmonitor.stores import STORES

fx.configure(fixed=1400)


def variation(pid, name, online=True, sizes=None, cat="hoodie"):
    sizes = sizes or {}
    return {"product": {
        "id": pid, "productName": name, "online": online, "available": any(sizes.values()),
        "masterProductId": pid, "primaryCategory": cat, "selectedProductUrl": f"/{cat}/x/{pid}.html?dwvar=1",
        "price": {"sales": {"decimalPrice": "1450.00"}}, "images": {"large": [{"url": "https://img/x.png"}]},
        "variationAttributes": [{"id": "size", "values": [
            {"id": sid, "displayValue": lab, "selectable": ok} for sid, (lab, ok) in sizes.items()]}]}}


def tile(pid, name="X", cat="Socks"):
    return (f'<span class="product-metadata d-none" data-pid="{pid}" data-name="{name}" data-price="255.00" '
            f'data-category="{cat}"></span><a href="/socks/x/{pid}.html">x</a>')


class FakeCH:
    def __init__(self, grid, variations):
        self.grid, self.variations = grid, variations

    def get(self, url):
        if "Search-UpdateGrid" in url:
            return self.grid if "cgid=root" in url and "start=0" in url else ""
        if "Product-Variation" in url:
            pid = url.split("pid=")[1].split("&")[0]
            if pid in self.variations:
                return json.dumps(self.variations[pid])
            raise FetchError(url, 500, "Internal Server Error")
        return ""


class CHHiddenTests(unittest.TestCase):
    def test_pid_from(self):
        self.assertEqual(pid_from("https://www.chromehearts.com/hoodie/x/176354XXXXXX349.html?q=1"), "176354XXXXXX349")
        self.assertEqual(pid_from(" 151407xxxxxx00s "), "151407XXXXXX00S")
        self.assertIsNone(pid_from("hoodie"))

    def test_archive_keeps_hoodies_and_tops_hoodies_first(self):
        rows = [["original"],
                ["https://www.chromehearts.com/socks/ch-logo-socks/176354XXXXXX349.html"],
                ["https://www.chromehearts.com/t-shirts/scroll-tee/111111XXXXXX001.html"],
                ["https://www.chromehearts.com/hoodie/cemetery-zip-up/222222BLKXXX002.html?x=1"],
                ["https://www.chromehearts.com/hoodie/cemetery-zip-up/222222BLKXXX002.html"]]
        got = parse_archive(rows)
        self.assertEqual([g["pid"] for g in got], ["222222BLKXXX002", "111111XXXXXX001"])

    def test_offline_is_not_hidden(self):
        self.assertIsNone(product_from(variation("P", "SCARF", online=False)))
        p = product_from(variation("P", "CEMETERY HOODIE", sizes={"MED": ("M", True)}))
        self.assertTrue(p.hidden)
        self.assertEqual((p.price, p.sizes, p.url), ("1450.00", {"MED": True}, "https://www.chromehearts.com/hoodie/x/P.html"))

    def test_user_link_found_and_priority_alert(self):
        with tempfile.TemporaryDirectory() as d:
            cfg = load_config(None)
            cfg["state_file"] = str(Path(d) / "s.json")
            sent = []

            class N(Notifier):
                def send(self, ev):
                    sent.append(ev)

            shop = FakeCH(tile("A"), {})
            mon = Monitor(cfg, client=shop, notifier=N(cfg), store="chromehearts")
            mon.run_once()  # baseline
            self.assertTrue(mon.hidden.add_user("https://www.chromehearts.com/hoodie/x/333333BLKXXX003.html"))
            shop.variations["333333BLKXXX003"] = variation("333333BLKXXX003", "DAGGER ZIP UP",
                                                            sizes={"MED": ("M", True), "LRG": ("L", True)})
            mon.run_once()
            self.assertEqual([(e.kind, e.product.name) for e in sent], [("new_product", "DAGGER ZIP UP")])
            ev = sent[0]
            self.assertTrue(ev.product.hidden and ev.info.get("priority"))
            n = Notifier(cfg)
            self.assertIn("🔗 히든링크", n.message(ev, n.link(ev)).headline)
            self.assertIn("dwvar_333333BLKXXX003_size=MED", n.link(ev))
            mon.run_once()  # still hidden and online: no repeat
            self.assertEqual(len(sent), 1)

    def test_product_that_left_the_grid_is_rechecked(self):
        st = {}
        old = {"OLD": type("P", (), {"listed": False, "hidden": False})()}
        h = ChromeHeartsHidden(STORES["chromehearts"], st, lambda: old)
        shop = FakeCH("", {"OLD": variation("OLD", "SCROLL HOODIE", sizes={"XLG": ("XL", True)})})
        got = h.scan(shop, [], per_check=8)
        self.assertEqual([p.name for p in got], ["SCROLL HOODIE"])
        self.assertEqual(st["found"], ["OLD"])


if __name__ == "__main__":
    unittest.main()
