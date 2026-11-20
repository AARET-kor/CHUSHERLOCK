"""Sort products by how much they matter for a drop.

  hoodie     hoodies, zip-up hoodies, no-zip hoodies         (watched hardest)
  top        sweatshirts, crewnecks, tees, long sleeves, shirts, knits
  apparel    bottoms, outerwear, and any clothing not recognised above
  accessory  shoes, hats, eyewear, bags, cases, jewellery
  other      Baccarat glassware, scents, underwear, socks, kids

By default only hoodie and top send alerts; the dashboard's main tab shows
hoodie, top and apparel.
"""

from __future__ import annotations

import re

HOODIE, TOP, APPAREL, ACCESSORY, OTHER = "hoodie", "top", "apparel", "accessory", "other"
ORDER = [HOODIE, TOP, APPAREL, ACCESSORY, OTHER]
MAIN = [HOODIE, TOP, APPAREL]  # the dashboard's main tab
LABELS = {HOODIE: "후디·집업", TOP: "상의", APPAREL: "하의·아우터", ACCESSORY: "신발·액세서리", OTHER: "기타"}
# older configs: "main" meant all clothing, and "apparel" used to include tops
LEGACY = {"main": [HOODIE, TOP, APPAREL]}

_HOODIE = ["hoodie", "hoody", "hooded", "hood"]
# "ZIP UP" alone means a zip hoodie at Chrome Hearts, but not on a fleece or a jacket
_ZIP_UP = ["zip up", "zip-up", "zipup"]
_NOT_HOODIE_ZIP = ["fleece", "jacket", "crewneck", "crew neck", "sweatshirt", "track", "cardigan", "vest", "knit", "pile"]
_OTHER = [
    "baccarat", "scent", "candle", "incense", "soap", "perfume", "parfum", "fragrance", "matchstick",
    "martini", "flute", "decanter", "tumbler", "glass", "coffee set", "ashtray", "old fashion", "vase", "cup",
    "underwear", "undergarment", "intimate", "boxer", "brief", "legging", "tights", "long johns", "bra", "panty",
    "thong", "sock", "home", "gift card", "sticker", "vinyl", "record", "book", "poster", "mug", "towel", "blanket",
]
_ACCESSORY = [
    "footwear", "shoe", "sneaker", "boot", "slipper", "sandal", "slide", "clog", "loafer", "matterdaddies",
    "hat", "cap", "beanie", "trucker", "bucket", "visor", "eyewear", "sunglass", "glasses", "optical", "goggle",
    "scarf", "bandana", "glove", "bag", "tote", "backpack", "wallet", "belt", "keychain", "key ring", "lighter",
    "case", "phone", "ring", "necklace", "bracelet", "pendant", "earring", "chain", "dog tag", "jewel", "accessor",
    "durag", "du rag", "wave cap", "boutonniere", "pin", "brooch", "money clip", "key fob", "fob", "patch",
]
# bottoms and outerwear: checked before tops, so a "shirt jacket" or "jersey pant" is not a top
_OUTER_BOTTOM = [
    "bottom", "pant", "sweats", "sweatpant", "sweatshort", "jogger", "jean", "trouser", "short", "skirt", "overall",
    "jacket", "coat", "vest", "parka", "bomber", "puffer", "down jacket", "outer", "blouson", "fleece", "anorak",
    "windbreaker", "slicker", "track", "mesh",
]
_TOP = [
    "top", "sweatshirt", "crewneck", "crew neck", "sweater", "cardigan", "knit", "pullover", "quarter zip",
    "half zip", "t-shirt", "t shirt", "tee", "shirt", "long sleeve", "l/s", "s/s", "ls tee", "tank", "henley",
    "thermal", "polo", "flannel", "jersey", "rugby", "button up", "button-up", "oxford", "blouse",
]

KO = {
    "hoodie": "후디", "hoodies": "후디", "zip hoodie": "후드집업", "zip up": "후드집업", "tops": "상의", "top": "상의",
    "bottoms": "하의", "sweatpants": "스웻팬츠", "sports mesh": "스포츠 메시", "footwear": "신발", "eyewear": "아이웨어",
    "cases": "케이스", "socks": "양말", "scents": "향", "baccarat": "바카라 글라스", "underwear": "속옷",
    "intimates": "이너웨어", "boxers leggings": "박서·레깅스", "boxers & leggings": "박서·레깅스",
    "hat": "모자", "hats": "모자", "scarf": "스카프", "slippers": "슬리퍼", "shop": "전체", "outerwear": "아우터",
    "jackets": "자켓", "accessories": "액세서리", "t shirts": "티셔츠", "tees": "티셔츠", "tee": "티셔츠",
    "ls tee": "롱슬리브", "ls shirt": "셔츠", "crewneck": "맨투맨", "sweatshirt": "맨투맨", "sweater": "니트",
    "clothing": "의류", "ss tee": "반팔 티셔츠", "thermal": "써멀", "polo": "폴로", "rugby": "럭비 셔츠",
    "quarter zip": "쿼터집", "half zip": "하프집",
}


def _pattern(words: list[str]) -> re.Pattern:
    # word start, optional plural: "sock" matches "SOCKS" but "cap" doesn't match "capri"
    return re.compile(r"(?<![a-z])(" + "|".join(re.escape(w) for w in words) + r")(e?s)?(?![a-z])")


_RE_ZIP, _RE_NOT_ZIP = _pattern(_ZIP_UP), _pattern(_NOT_HOODIE_ZIP)
_RE_OUTER = _pattern(["jacket", "coat", "parka", "puffer", "fleece", "bomber", "blouson", "anorak",
                      "windbreaker", "slicker"])
_RE_KIDS = _pattern(["kid", "kids", "toddler", "baby", "infant", "youth"])
_RE = {
    HOODIE: _pattern(_HOODIE), OTHER: _pattern(_OTHER), ACCESSORY: _pattern(_ACCESSORY),
    APPAREL: _pattern(_OUTER_BOTTOM), TOP: _pattern(_TOP),
}


def classify(name: str = "", category: str = "") -> str:
    cat = category.lower().replace("-", " ").replace("_", " ")
    text = f"{name} {cat}".lower()
    if _RE_KIDS.search(text):
        return OTHER
    if _RE[HOODIE].search(text) or (_RE_ZIP.search(text) and not _RE_NOT_ZIP.search(text)):
        return HOODIE  # "NO ZIP HOODIE" filed under TOPS is still a hoodie
    if _RE_OUTER.search(text):  # a "Fleece Quarter Zip Jacket" filed under Quarter Zip is outerwear
        return APPAREL
    # then the store's own category is the strongest signal
    for g in (OTHER, ACCESSORY, APPAREL, TOP):
        if _RE[g].search(cat):
            return g
    for g in (APPAREL, TOP, OTHER, ACCESSORY):
        if _RE[g].search(text):
            return g
    return APPAREL  # clothing we can't place: shown on the main tab, no alert


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
