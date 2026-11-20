"""Shopify storefronts (SKYLRK): the public products.json and collections.json.

One request returns every product with per-variant stock, so there is no
separate stock check and restocks are seen for every product.
"""

from __future__ import annotations

import html
import json
import re
import urllib.parse

from .site import Client, FetchError, Product

PAGE_LIMIT = 250


def _size_option(product: dict) -> int | None:
    for opt in product.get("options") or []:
        if str(opt.get("name", "")).strip().lower() in ("size", "sizes", "사이즈"):
            return int(opt.get("position") or 1)
    return None


def parse_product(base: str, d: dict, store: str) -> Product:
    variants = d.get("variants") or []
    pos = _size_option(d)
    sizes: dict[str, bool] = {}
    size_variants: dict[str, str] = {}
    for v in variants:
        size = v.get(f"option{pos}") if pos else None
        if not size:
            continue
        sizes[size] = sizes.get(size, False) or bool(v.get("available"))
        # remember an in-stock variant for the size when there is one
        if v.get("available") or size not in size_variants:
            size_variants[size] = str(v["id"])
    prices = [float(v["price"]) for v in variants if v.get("price")]
    images = d.get("images") or []
    image = images[0]["src"] if images else ""
    if image:
        image += ("&" if "?" in image else "?") + "width=600"
    return Product(
        pid=str(d["id"]),
        name=html.unescape(d.get("title", "")).strip(),
        price=f"{min(prices):.2f}" if prices else "",
        category=(d.get("product_type") or "").strip(),
        url=f"{base}/products/{d.get('handle', '')}",
        image=image,
        sizes=sizes,
        size_labels={s: s for s in sizes},
        available=any(v.get("available") for v in variants),
        store=store,
        size_variants=size_variants,
    )


def fetch_products(client: Client, base: str, store: str, max_pages: int = 8) -> list[Product]:
    out: dict[str, Product] = {}
    for page in range(1, max_pages + 1):
        body = client.get(f"{base}/products.json?limit={PAGE_LIMIT}&page={page}")
        try:
            items = json.loads(body or "{}").get("products") or []
        except ValueError:
            raise FetchError(f"{base}/products.json", None, "JSON이 아님 (점검 중이거나 차단됨)") from None
        for d in items:
            p = parse_product(base, d, store)
            out[p.pid] = p
        if len(items) < PAGE_LIMIT:
            break
    return list(out.values())


TITLES: dict[str, str] = {}  # collection handle -> title, filled by fetch_collections


def fetch_collections(client: Client, base: str) -> dict[str, int]:
    """{collection handle: product count}; titles go to TITLES"""
    body = client.get(f"{base}/collections.json?limit=250")
    try:
        cols = json.loads(body or "{}").get("collections") or []
    except ValueError:
        raise FetchError(f"{base}/collections.json", None, "JSON이 아님") from None
    for c in cols:
        if c.get("handle") and c.get("title"):
            TITLES[c["handle"]] = html.unescape(c["title"]).strip()
    return {c["handle"]: int(c.get("products_count") or 0) for c in cols if c.get("handle")}


def buy_url(base: str, product: Product, size: str | None = None) -> str:
    """With a size: Shopify cart permalink, i.e. that size already in the cart, at checkout."""
    vid = product.size_variants.get(size) if size else None
    if vid and product.sizes.get(size):
        return f"{base}/cart/{vid}:1"
    return product.url or base


def collection_url(base: str, handle: str) -> str:
    return f"{base}/collections/{urllib.parse.quote(handle)}"


def title_from_handle(handle: str) -> str:
    return re.sub(r"[-_]+", " ", handle).strip()
