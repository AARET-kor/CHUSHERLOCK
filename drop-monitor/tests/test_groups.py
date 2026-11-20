import unittest

from chmonitor.groups import ACCESSORY, APPAREL, HOODIE, OTHER, classify, expand, ko_category


class GroupTests(unittest.TestCase):
    def test_hoodies_first(self):
        for name, cat in [("CEMETERY HOODIE", "Hoodie"), ("DAGGER ZIP UP", ""), ("NO ZIP HOODIE", "TOPS"),
                          ("NO ZIP - DOTS", "HOODIES"), ("BATWING REVERSE HOODIE", "HOODIES")]:
            self.assertEqual(classify(name, cat), HOODIE, name)

    def test_apparel(self):
        for name, cat in [("MATTY BOY CREWNECK", ""), ("CH PLUS SWEATPANTS", "Sweatpants"),
                          ("LEATHER JACKET", "Outerwear"), ("SWEATS", "BOTTOMS"), ("REVERSE SWEATS JOGGER", "BOTTOMS"),
                          ("SPORTS MESH SHORTS", "Sports Mesh"), ("SOMETHING NEW", "")]:
            self.assertEqual(classify(name, cat), APPAREL, name)

    def test_shoes_and_accessories(self):
        for name, cat in [("MATTERDADDIES - TOY", "FOOTWEAR"), ("GLICKY - GLOSS", "EYEWEAR"), ("BUMP CASE", "CASES"),
                          ("TRUCKER CAP", "Hat"), ("CROSS SLIPPERS", "Slippers")]:
            self.assertEqual(classify(name, cat), ACCESSORY, name)

    def test_other(self):
        for name, cat in [("MARTINI", "Baccarat"), ("CH LOGO SOCKS", "Socks"), ("THIN LOOP SOCK 2-PACK", "SOCKS"),
                          ("BOXER BRIEF - SHORTS", "BOXERS & LEGGINGS"), ("CH PLUS TIGHTS", "INTIMATES")]:
            self.assertEqual(classify(name, cat), OTHER, name)

    def test_category_names(self):
        self.assertEqual(classify("hoodie"), HOODIE)
        self.assertEqual(classify("sunken sneaker drop"), ACCESSORY)
        self.assertEqual(classify("boxers leggings"), OTHER)

    def test_legacy_main_and_korean(self):
        self.assertEqual(expand(["main", "accessory"]), [HOODIE, APPAREL, ACCESSORY])
        self.assertEqual(ko_category("HOODIES"), "후디")
        self.assertEqual(ko_category("boxers-leggings"), "박서·레깅스")
