"""The stores the monitor knows. Each one says how to read its catalogue."""

from __future__ import annotations

import urllib.parse

from . import shopify, site
from .site import Client, Product


class Store:
    id = ""
    name = ""
    base = ""
    stock_in_listing = False  # True: the product list already carries per-size stock
    category_word = "카테고리"
    default_interval = 60

    def products(self, client: Client) -> list[Product]:
        raise NotImplementedError

    def stock(self, client: Client, pid: str):
        return None

    def discover_categories(self, client: Client) -> list[str]:
        return []

    def category_counts(self, client: Client, categories: list[str]) -> dict[str, int]:
        return {}

    def buy_url(self, product: Product, size: str | None = None) -> str:
        return product.url or self.base

    def category_url(self, category: str) -> str:
        return self.base

    def category_title(self, category: str) -> str:
        return category


class ChromeHearts(Store):
    id, name, base = "chromehearts", "Chrome Hearts", site.BASE
    default_interval = 60

    def products(self, client):
        return site.fetch_category(client, "root")

    def stock(self, client, pid):
        return site.fetch_stock(client, pid)

    def discover_categories(self, client):
        return site.fetch_categories(client)

    def category_counts(self, client, categories):
        counts = {}
        for cg in categories:
            if cg == "root":
                continue
            counts[cg] = len(site.fetch_category(client, cg, max_pages=1))  # FetchError handled by caller
        return counts

    def buy_url(self, product, size=None):
        return site.buy_url(product, size)

    def category_url(self, category):
        return f"{self.base}/{urllib.parse.quote(category)}"


class ShopifyStore(Store):
    """Any Shopify storefront: products.json carries every product with per-size stock."""
    stock_in_listing = True
    category_word = "컬렉션"

    def __init__(self, id: str, name: str, base: str, default_interval: int = 45):
        self.id, self.name, self.base, self.default_interval = id, name, base, default_interval

    def products(self, client):
        return shopify.fetch_products(client, self.base, self.id)

    def category_counts(self, client, categories):
        return shopify.fetch_collections(client, self.base)

    def buy_url(self, product, size=None):
        return shopify.buy_url(self.base, product, size)

    def category_url(self, category):
        return shopify.collection_url(self.base, category)

    def category_title(self, category):
        return shopify.TITLES.get((self.base, category)) or shopify.title_from_handle(category)


STORES: dict[str, Store] = {s.id: s for s in (
    ChromeHearts(),
    ShopifyStore("skylrk", "SKYLRK", "https://skylrk.com", 45),             # one small request
    ShopifyStore("cpfm", "CPFM", "https://cactusplantfleamarket.com", 45),  # one small request
    ShopifyStore("denimtears", "Denim Tears", "https://denimtears.com", 75),  # ~2 MB per check, go easier
)}


def get(store_id: str) -> Store:
    return STORES.get(store_id) or STORES["chromehearts"]
