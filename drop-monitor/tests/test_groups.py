import unittest

from chmonitor.groups import ACCESSORY, MAIN, OTHER, classify


class GroupTests(unittest.TestCase):
    def test_real_store_items_are_other(self):
        for name, cat in [("MARTINI", "Baccarat"), ("+22+ Soap on a Rope", "Scents"), ("CH LOGO SOCKS", "Socks"),
                          ("BOXER BRIEF - SHORTS", "BOXERS & LEGGINGS"), ("CH PLUS TIGHTS", "INTIMATES"),
                          ("LONG JOHNS", "Underwear")]:
            self.assertEqual(classify(name, cat), OTHER, name)

    def test_apparel_is_main(self):
        for name, cat in [("CEMETERY HOODIE", "Hoodie"), ("DAGGER ZIP UP", ""), ("MATTY BOY CREWNECK", ""),
                          ("CH PLUS SWEATPANTS", "Sweatpants"), ("LEATHER JACKET", "Outerwear"),
                          ("SPORTS MESH SHORTS", "Sports Mesh"), ("CEMETERY CROSS T-SHIRT", ""),
                          ("SOMETHING NEW", "")]:
            self.assertEqual(classify(name, cat), MAIN, name)

    def test_accessories(self):
        for name, cat in [("TRUCKER CAP", "Hat"), ("HORSESHOE BEANIE", ""), ("SUNGLASSES", "Eyewear"),
                          ("CROSS SLIPPERS", "Slippers")]:
            self.assertEqual(classify(name, cat), ACCESSORY, name)

    def test_category_names(self):
        self.assertEqual(classify("", "hoodie"), MAIN)
        self.assertEqual(classify("", "SWEATPANTS"), MAIN)
        self.assertEqual(classify("", "baccarat"), OTHER)
        self.assertEqual(classify("", "boxers-leggings"), OTHER)
        self.assertEqual(classify("", "hat"), ACCESSORY)
