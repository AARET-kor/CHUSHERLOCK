"""Sort products by how much they matter for a drop.

  hoodie     hoodies, zip-up hoodies, no-zip hoodies  (watched hardest)
  apparel    sweatshirts, tees, pants, shorts, outerwear, and anything unknown
  accessory  shoes, hats, eyewear, bags, cases, jewellery
  other      Baccarat glassware, scents, underwear, socks

Unknown products land in "apparel" on purpose: a new kind of item is more
likely a drop worth seeing than noise.
"""

from __future__ import annotations

import re

HOODIE, APPAREL, ACCESSORY, OTHER = "hoodie", "apparel", "accessory", "other"
ORDER = [HOODIE, APPAREL, ACCESSORY, OTHER]
LABELS = {HOODIE: "후디·집업", APPAREL: "의류", ACCESSORY: "신발·액세서리", OTHER: "기타"}
# older configs said "main" for hoodies and apparel together
LEGACY = {"main": [HOODIE, APPAREL]}

_HOODIE = ["hoodie", "hoody", "hooded", "hood", "zip up", "zip-up", "zipup", "full zip", "half zip", "parka hood"]
_OTHER = [
    "baccarat", "scent", "candle", "incense", "soap", "perfume", "parfum", "fragrance", "matchstick",
    "martini", "flute", "decanter", "tumbler", "glass", "coffee set", "ashtray", "old fashion", "vase", "cup",
    "underwear", "intimate", "boxer", "brief", "legging", "tights", "long johns", "bra", "panty", "thong",
    "sock", "home", "gift card", "sticker",
]
_ACCESSORY = [
    "footwear", "shoe", "sneaker", "boot", "slipper", "sandal", "slide", "clog", "loafer", "matterdaddies",
    "hat", "cap", "beanie", "trucker", "bucket", "visor", "eyewear", "sunglass", "glasses", "optical", "goggle",
    "scarf", "bandana", "glove", "bag", "tote", "backpack", "wallet", "belt", "keychain", "key ring", "lighter",
    "case", "phone", "ring", "necklace", "bracelet", "pendant", "earring", "chain", "dog tag", "jewel", "accessor",
]
_APPAREL = [
    "sweatshirt", "crewneck", "crew neck", "sweater", "cardigan", "knit", "top",
    "t-shirt", "tee", "shirt", "long sleeve", "l/s", "s/s", "tank", "henley", "thermal", "polo", "flannel", "jersey",
    "bottom", "pant", "sweats", "sweatpant", "jogger", "jean", "denim", "trouser", "short", "track", "mesh",
    "jacket", "coat", "vest", "parka", "bomber", "puffer", "down", "outer", "leather", "blouson", "fleece", "apparel",
]

KO = {
    "hoodie": "후디", "hoodies": "후디", "zip up": "후드집업", "tops": "상의", "top": "상의", "bottoms": "하의",
    "sweatpants": "스웻팬츠", "sports mesh": "스포츠 메시", "footwear": "신발", "eyewear": "아이웨어",
    "cases": "케이스", "socks": "양말", "scents": "향", "baccarat": "바카라 글라스", "underwear": "속옷",
    "intimates": "이너웨어", "boxers leggings": "박서·레깅스", "boxers & leggings": "박서·레깅스",
    "hat": "모자", "hats": "모자", "scarf": "스카프", "slippers": "슬리퍼", "shop": "전체", "outerwear": "아우터",
    "jackets": "자켓", "accessories": "액세서리", "t shirts": "티셔츠", "tees": "티셔츠",
}


def _pattern(words: list[str]) -> re.Pattern:
    # word start, optional plural: "sock" matches "SOCKS" but "cap" doesn't match "capri"
    return re.compile(r"(?<![a-z])(" + "|".join(re.escape(w) for w in words) + r")(e?s)?(?![a-z])")


_RE = {HOODIE: _pattern(_HOODIE), OTHER: _pattern(_OTHER), ACCESSORY: _pattern(_ACCESSORY), APPAREL: _pattern(_APPAREL)}


def classify(name: str = "", category: str = "") -> str:
    cat = category.lower().replace("-", " ").replace("_", " ")
    text = f"{name} {cat}".lower()
    if _RE[HOODIE].search(text):  # "NO ZIP HOODIE" filed under TOPS is still a hoodie
        return HOODIE
    # then the store's own category is the strongest signal
    for g in (OTHER, ACCESSORY, APPAREL):
        if _RE[g].search(cat):
            return g
    for g in (APPAREL, OTHER, ACCESSORY):
        if _RE[g].search(text):
            return g
    return APPAREL


def expand(groups: list[str]) -> list[str]:
    out: list[str] = []
    for g in groups or []:
        for x in LEGACY.get(g, [g]):
            if x not in out:
                out.append(x)
    return out


def ko_category(category: str) -> str:
    key = category.lower().replace("-", " ").replace("_", " ").strip()
    return KO.get(key, category)
