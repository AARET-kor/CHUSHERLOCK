import unittest

from chmonitor import fx
from chmonitor.detect import Event
from chmonitor.monitor import load_config
from chmonitor.notify import Notifier
from chmonitor.priority import DEFAULT_RULES, live_hits, mark
from chmonitor.site import Product

fx.configure(fixed=1400)
LABELS = {"SML": "S", "MED": "M", "LRG": "L", "XLG": "XL"}


def ch(name="CEMETERY HOODIE", cat="Hoodie", **stock):
    return Product(pid="P1", name=name, price="1450.00", category=cat, url="https://www.chromehearts.com/h/P1.html",
                   sizes={k: stock.get(k, False) for k in LABELS}, size_labels=dict(LABELS))


class PriorityTests(unittest.TestCase):
    def test_new_hoodie_in_m(self):
        ev = Event("new_product", "신상품: X", product=ch(MED=True, LRG=True))
        self.assertTrue(mark(ev, DEFAULT_RULES, "chromehearts"))
        self.assertEqual((ev.info["size"], ev.info["hits"]), ("MED", ["M"]))

    def test_xl_when_m_is_gone(self):
        ev = Event("new_product", "신상품: X", product=ch(name="DAGGER ZIP UP", cat="", XLG=True))
        self.assertTrue(mark(ev, DEFAULT_RULES, "chromehearts"))
        self.assertEqual(ev.info["size"], "XLG")

    def test_only_l_is_not_priority(self):
        self.assertFalse(mark(Event("new_product", "", product=ch(LRG=True)), DEFAULT_RULES, "chromehearts"))

    def test_restock_counts_only_for_our_sizes(self):
        back_l = Event("restock", "", product=ch(MED=True, LRG=True), info={"sizes_back": ["LRG"]})
        back_xl = Event("restock", "", product=ch(XLG=True), info={"sizes_back": ["XLG"]})
        self.assertFalse(mark(back_l, DEFAULT_RULES, "chromehearts"))  # M was already there
        self.assertTrue(mark(back_xl, DEFAULT_RULES, "chromehearts"))

    def test_not_a_hoodie_or_other_store(self):
        self.assertFalse(mark(Event("new_product", "", product=ch(name="CEMETERY TEE", cat="Tees", MED=True)),
                              DEFAULT_RULES, "chromehearts"))
        self.assertFalse(mark(Event("new_product", "", product=ch(MED=True)), DEFAULT_RULES, "skylrk"))
        self.assertFalse(mark(Event("price_change", "", product=ch(MED=True)), DEFAULT_RULES, "chromehearts"))

    def test_message_and_link(self):
        n = Notifier(load_config(None))
        ev = Event("new_product", "신상품: CEMETERY HOODIE", product=ch(MED=True), store="chromehearts")
        mark(ev, DEFAULT_RULES, "chromehearts")
        link = n.link(ev)
        m = n.message(ev, link)
        self.assertIn("dwvar_P1_size=MED", link)
        self.assertEqual(m.headline, "🔥🔥 [Chrome Hearts] 후디 M 재고 — 지금 구매")
        self.assertEqual(m.buttons[0][0], "🛒 M 사이즈로 지금 구매")

    def test_reminders_repeat_on_telegram(self):
        cfg = load_config(None)
        cfg["telegram"].update(enabled=True, bot_token="t", chat_id="1")
        cfg.update(desktop=False, sound=False, auto_open_browser=False)
        sent = []
        n = Notifier(cfg)
        n._telegram = lambda m, link: sent.append(m.headline)
        ev = Event("new_product", "신상품: X", product=ch(MED=True), store="chromehearts")
        mark(ev, [{**DEFAULT_RULES[0], "repeat": 2, "repeat_every": 0.01}], "chromehearts")
        n.send(ev)
        import time
        time.sleep(0.3)
        self.assertEqual(len(sent), 3)
        self.assertTrue(sent[1].startswith("⏰ 다시 알림 1/2"))

    def test_dashboard_badge(self):
        self.assertEqual(live_hits(ch(MED=True, XLG=True), DEFAULT_RULES, "chromehearts"), ["M", "XL"])
        self.assertEqual(live_hits(ch(LRG=True), DEFAULT_RULES, "chromehearts"), [])


if __name__ == "__main__":
    unittest.main()
