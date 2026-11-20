import unittest

from chmonitor.groups import ACCESSORY, APPAREL, HOODIE, OTHER, TOP, classify, expand, ko_category


class GroupTests(unittest.TestCase):
    def test_hoodies_first(self):
        for name, cat in [("CEMETERY HOODIE", "Hoodie"), ("DAGGER ZIP UP", ""), ("NO ZIP HOODIE", "TOPS"),
                          ("NO ZIP - DOTS", "HOODIES"), ("BATWING REVERSE HOODIE", "HOODIES")]:
            self.assertEqual(classify(name, cat), HOODIE, name)

    def test_zip_up_is_a_hoodie_unless_it_is_a_fleece_or_jacket(self):
        self.assertEqual(classify("DAGGER ZIP UP", ""), HOODIE)
        self.assertEqual(classify("Distressed Tackle Twill Zip Up Hoodie Navy", "Zip Hoodie"), HOODIE)
        self.assertEqual(classify("Spacebrat Vixen Pile Fleece Zip-Up", "Crewneck"), APPAREL)
        self.assertEqual(classify("Kids Cotton Wreath Zip Hoodie Black", "Kids"), OTHER)
        self.assertEqual(classify("Thermal Cotton Wreath Durag Black", "Durag"), ACCESSORY)
        self.assertEqual(classify('Fela Kuti "Zombie" Vinyl Record', "Vinyl Record"), OTHER)

    def test_tops(self):
        for name, cat in [("MATTY BOY CREWNECK", ""), ("Cotton Wreath Sweatshirt Black", "Sweatshirt"),
                          ("Jesus Tee White", "SS Tee"), ("Peace Wreath Thermal Long Sleeve Black", "Thermal"),
                          ("Mini Wreath Plaid Button Up", "LS Shirt"), ("Stüssy Tears Polo White", "Polo"),
                          ("CEMETERY CROSS T-SHIRT", ""), ("RODEO CROCHET KNIT CARDIGAN", "clothing"),
                          ("André Leon Talley Quarter-Zip Sweatshirt Grey", "Half Zip")]:
            self.assertEqual(classify(name, cat), TOP, name)

    def test_bottoms_and_outerwear(self):
        for name, cat in [("CH PLUS SWEATPANTS", "Sweatpants"), ("LEATHER JACKET", "Outerwear"), ("SWEATS", "BOTTOMS"),
                          ("REVERSE SWEATS JOGGER", "BOTTOMS"), ("SPORTS MESH SHORTS", "Sports Mesh"),
                          ("Denim U Sweatshorts Grey", "Sweat Short"), ("Metallic Denim Jacket", "Denim Jacket"),
                          ("Polar Fleece Quarter Zip Jacket Black", "Quarter Zip"),
                          ("Spacebrat Vixen Pile Fleece Zip-Up", "Crewneck"), ("SOMETHING NEW", "")]:
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
        self.assertEqual(expand(["main", "accessory"]), [HOODIE, TOP, APPAREL, ACCESSORY])
        self.assertEqual(ko_category("HOODIES"), "후디")
        self.assertEqual(ko_category("boxers-leggings"), "박서·레깅스")
