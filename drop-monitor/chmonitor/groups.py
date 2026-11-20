"""Sort products into what matters for a drop and what doesn't.

  main       hoodies, sweats, tops and bottoms, outerwear, and anything unknown
  accessory  hats, eyewear, scarves, slippers, bags, jewellery
  other      Baccarat glassware, scents, underwear and socks

Unknown products land in "main" on purpose: a new kind of item is more likely
a drop worth seeing than noise.
"""

from __future__ import annotations

import re

MAIN, ACCESSORY, OTHER = "main", "accessory", "other"
LABELS = {MAIN: "메인", ACCESSORY: "모자·액세서리", OTHER: "기타"}

_OTHER = [
    "baccarat", "scent", "candle", "incense", "soap", "perfume", "parfum", "fragrance", "matchstick",
    "martini", "flute", "decanter", "tumbler", "glass", "coffee set", "ashtray", "old fashion", "vase", "cup",
    "underwear", "intimate", "boxer", "brief", "legging", "tights", "long johns", "bra", "panty", "thong",
    "sock", "home",
]
_ACCESSORY = [
    "hat", "cap", "beanie", "trucker", "bucket", "visor", "eyewear", "sunglass", "glasses", "optical",
    "scarf", "bandana", "glove", "slipper", "sandal", "shoe", "sneaker", "boot",
    "bag", "tote", "backpack", "wallet", "belt", "keychain", "key ring", "lighter",
    "ring", "necklace", "bracelet", "pendant", "earring", "chain", "dog tag", "jewel",
]
_MAIN = [
    "hoodie", "hooded", "zip up", "zip-up", "sweatshirt", "crewneck", "sweater", "cardigan", "knit",
    "t-shirt", "tee", "shirt", "long sleeve", "l/s", "s/s", "tank", "henley", "thermal", "polo", "flannel",
    "pant", "sweatpant", "jogger", "jean", "denim", "trouser", "short", "track", "mesh",
    "jacket", "coat", "vest", "parka", "bomber", "puffer", "down", "outer", "leather", "blouson", "fleece",
]


def _pattern(words: list[str]) -> re.Pattern:
    # word start, optional plural: "sock" matches "SOCKS" but "cap" doesn't match "capri"
    return re.compile(r"(?<![a-z])(" + "|".join(re.escape(w) for w in words) + r")(e?s)?(?![a-z])")


_RE_OTHER, _RE_ACC, _RE_MAIN = _pattern(_OTHER), _pattern(_ACCESSORY), _pattern(_MAIN)


def classify(name: str = "", category: str = "") -> str:
    cat = category.lower().replace("-", " ")
    text = f"{name} {category}".lower()
    # the store's own category is the strongest signal
    if _RE_OTHER.search(cat):
        return OTHER
    if _RE_ACC.search(cat):
        return ACCESSORY
    if _RE_MAIN.search(cat):
        return MAIN
    if _RE_MAIN.search(text):
        return MAIN
    if _RE_OTHER.search(text):
        return OTHER
    if _RE_ACC.search(text):
        return ACCESSORY
    return MAIN
