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
               "sweats", "reverse-sweats", "reverse-sweats-jogger", "jogger"]
SUFFIXES = ["", "-1", "-2", "-3"]


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

    def guesses(self, listed: list[Product]) -> list[str]:
        if not self.guesses_on:
            return []
        colors: list[str] = []
        for p in listed:  # colours the store already uses, from the end of its handles
            tail = p.url.rsplit("/", 1)[-1].split("-")[-1]
            if tail.isalpha() and len(tail) > 2 and tail not in colors:
                colors.append(tail)
        out: list[str] = []
        for base in HOODIE_BASES:  # hoodies first
            out += [base + s for s in SUFFIXES]
        for base in HOODIE_BASES[:8]:
            out += [f"{base}-{c}" for c in colors[:16]]
        for base in OTHER_BASES:
            out += [base + s for s in SUFFIXES[:2]]
        seen: set[str] = set()
        return [h for h in out if not (h in seen or seen.add(h))]

    # -- one pass

    def scan(self, client: Client, listed: list[Product], per_check: int = 12) -> list[Product]:
        listed_handles = {p.url.rsplit("/", 1)[-1] for p in listed}
        if not self.sitemap or self.cycle % 20 == 0:
            try:
                self.sitemap = shopify.sitemap_handles(client, self.store.base)
            except FetchError as e:
                log.debug("[%s] 사이트맵 실패: %s", self.store.name, e)
        self.cycle += 1

        every = []
        for h in self.state["found"] + self.state["user"] + self.sitemap:
            if h not in listed_handles and h not in every:
                every.append(h)
        # rotate through the full, fixed guess list so finding a link never makes us skip one
        guesses = self.guesses(listed)
        start = self.state["cursor"] % len(guesses) if guesses else 0
        window = (guesses[start:] + guesses[:start])[:per_check]
        self.state["cursor"] = start + len(window)
        batch = [h for h in window if h not in listed_handles and h not in every]

        out: list[Product] = []
        for h in every + batch:
            try:
                p = shopify.fetch_product_js(client, self.store.base, h, self.store.id)
            except FetchError as e:
                if e.status == 429:  # the store wants us to slow down: stop for this check
                    log.warning("[%s] 히든링크 확인 중 429, 이번 회차 중단", self.store.name)
                    break
                continue
            if not p:
                continue
            p.hidden = True
            out.append(p)
            if h not in self.state["found"]:
                self.state["found"].append(h)
                del self.state["found"][:-MAX_FOUND]
                log.info("[%s] 🔗 히든링크 발견: %s/products/%s", self.store.name, self.store.base, h)
        self.state["live"] = len(out)
        return out
