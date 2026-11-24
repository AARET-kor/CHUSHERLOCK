"""Hidden links: products a Shopify store sells by direct URL only.

SKYLRK puts drops up as "unlisted" products. They are missing from
products.json, collections and search, but /products/<handle> works for
anyone who knows the handle, and /products/<handle>.js gives the same stock
data. Handles follow a pattern (zip-hoodie, reverse-zip-hoodie-1,
no-zip-hoodie-cashew), so the monitor looks in three places:

  1. handles it has found before, and handles the user added: every check
  2. handles in the sitemap but not in products.json: every check
  3. guesses from the store's naming pattern: a few per check, in rotation,
     hoodie names first
"""

from __future__ import annotations

import logging
import re

from . import shopify
from .site import Client, FetchError, Product

log = logging.getLogger("chmonitor")

HANDLE_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,99}$")
MAX_FOUND = 80
MAX_USER = 100

# names SKYLRK has used or is likely to use for hoodies (watched hardest) and other tops
HOODIE_BASES = [
    "hoodie", "zip-hoodie", "reverse-hoodie", "reverse-zip-hoodie", "no-zip-hoodie", "reverse-no-zip-hoodie",
    "reverse-no-zip", "no-zip", "batwing-hoodie", "batwing-reverse-hoodie", "batwing-zip-hoodie", "zip-up",
    "reverse-zip-up", "full-zip-hoodie", "pullover-hoodie", "thermal-hoodie",
]
OTHER_BASES = ["crewneck", "reverse-crewneck", "sweatshirt", "tee", "long-sleeve", "long-sleeve-tee", "thermal",
               "sweats", "reverse-sweats", "reverse-sweats-jogger", "jogger", "reverse-jogger", "sweatpants"]
SUFFIXES = ["", "-1", "-2", "-3", "-4", "-5"]


def handle_from(text: str) -> str | None:
    """'https://skylrk.com/products/reverse-zip-hoodie-1?variant=1' or 'reverse-zip-hoodie-1' -> the handle."""
    t = (text or "").strip().lower()
    m = re.search(r"/products/([a-z0-9-]+)", t)
    h = m.group(1) if m else t.strip("/").split("?")[0].split("#")[0]
    return h if HANDLE_RE.match(h) else None


def _slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


class HiddenLinks:
    def __init__(self, store, state: dict, guesses: bool):
        self.store = store
        self.state = state  # persisted: found, user, cursor
        self.state.setdefault("found", [])
        self.state.setdefault("user", [])
        self.state.setdefault("cursor", 0)
        self.guesses_on = guesses
        self.sitemap: list[str] = []
        self.cycle = 0

    # -- candidate lists

    def add_user(self, handle: str) -> bool:
        if handle in self.state["user"] or len(self.state["user"]) >= MAX_USER:
            return False
        self.state["user"].append(handle)
        return True

    def guesses(self, listed: list[Product]) -> tuple[list[str], list[str]]:
        """(fast, slow) handles to try, each in a fixed order so the rotation never skips one.
        fast: hoodie names and -1..-5. slow: hoodie names with every colour the store uses, then
        other tops and bottoms."""
        if not self.guesses_on:
            return [], []
        colors = list(dict.fromkeys(shopify.slug(c) for c in getattr(self.store, "colors", []) if c))
        fast = [base + s for base in HOODIE_BASES for s in SUFFIXES]
        slow = [f"{base}-{c}" for base in HOODIE_BASES for c in colors]
        for base in OTHER_BASES:
            slow += [base + s for s in SUFFIXES] + [f"{base}-{c}" for c in colors]
        fast = list(dict.fromkeys(fast))
        return fast, [h for h in dict.fromkeys(slow) if h not in fast]

    # -- one pass

    def scan(self, client: Client, listed: list[Product], per_check: int = 12) -> list[Product]:
        listed_handles = {shopify.handle_of(p) for p in listed} | set(getattr(self.store, "public_handles", set()))
        if not self.sitemap or self.cycle % 20 == 0:
            try:
                self.sitemap = shopify.sitemap_handles(client, self.store.base)
            except FetchError as e:
                log.debug("[%s] 사이트맵 실패: %s", self.store.name, e)
        self.cycle += 1

        self.state["found"] = [h for h in self.state["found"] if h not in listed_handles]
        every = []
        for h in self.state["found"] + self.state["user"] + self.sitemap:
            if h not in listed_handles and h not in every:
                every.append(h)
        # rotate through each fixed guess list so finding a link never makes us skip one
        fast, slow = self.guesses(listed)
        n_fast = max(1, per_check * 2 // 3)
        window = []
        for key, items, n in (("cursor", fast, n_fast), ("cursor_slow", slow, max(1, per_check - n_fast))):
            if not items:
                continue
            start = self.state.get(key, 0) % len(items)
            take = (items[start:] + items[:start])[:n]
            self.state[key] = start + len(take)
            window += take
        batch = [h for h in window if h not in listed_handles and h not in every]

        out: list[Product] = []
        live = 0
        for h in every + batch:
            try:
                d = shopify.fetch_js(client, self.store.base, h)
            except FetchError as e:
                if e.status == 429:  # the store wants us to slow down: stop for this check
                    log.warning("[%s] 히든링크 확인 중 429, 이번 회차 중단", self.store.name)
                    break
                continue
            if not d:
                continue
            live += 1
            self.store.colors = list(dict.fromkeys(getattr(self.store, "colors", []) + shopify.colors_of(d)))
            for p in shopify.parse_products(self.store.base, d, self.store.id, cents=True):
                p.hidden = True
                out.append(p)
            if h not in self.state["found"]:
                self.state["found"].append(h)
                del self.state["found"][:-MAX_FOUND]
                log.info("[%s] 🔗 히든링크 발견: %s/products/%s", self.store.name, self.store.base, h)
        self.state["live"] = live  # links, not colours
        return out
