"""Shopify storefronts (SKYLRK, CPFM, Denim Tears).

A product with several colours becomes one Product per colour (its own
image, stock per size, cart links and a link that opens that colour), so what
the monitor shows matches what a link opens.

Sources:
  - products.json: the catalogue (it leaves out unlisted products)
  - the home page: products it links that the catalogue leaves out are public too
  - /products/<handle>.js: one product by handle, also for unlisted ones
"""

from __future__ import annotations

import html
import json
import re
import urllib.parse

from .site import Client, FetchError, Product

PAGE_LIMIT = 250
SIZE_NAMES = ("size", "sizes", "사이즈")
COLOR_NAMES = ("color", "colour", "colors", "colorway", "색상")


def slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", str(s).lower()).strip("-")


def handle_of(p: Product) -> str:
    """The product handle from its URL (which may carry ?variant=)."""
    path = urllib.parse.urlparse(p.url).path
    return path.rsplit("/products/", 1)[-1].strip("/") if "/products/" in path else ""


def _positions(options) -> tuple[int | None, int | None]:
    """(size option position, colour option position); options may be dicts or bare names."""
    size = color = None
    for i, o in enumerate(options or [], 1):
        name = str(o.get("name") if isinstance(o, dict) else o).strip().lower()
        pos = int(o.get("position", i)) if isinstance(o, dict) else i
        if name in SIZE_NAMES:
            size = pos
        elif name in COLOR_NAMES:
            color = pos
    return size, color


def _img(src) -> str:
    if isinstance(src, dict):
        src = src.get("src") or ""
    src = src or ""
    if src.startswith("//"):
        src = "https:" + src
    return src + (("&" if "?" in src else "?") + "width=600" if src else "")


def parse_products(base: str, d: dict, store: str, cents: bool = False) -> list[Product]:
    """One product from products.json (cents=False) or /products/<h>.js (cents=True) -> one Product per colour."""
    size_pos, color_pos = _positions(d.get("options"))
    variants = d.get("variants") or []
    title = html.unescape(d.get("title", "")).strip()
    handle = d.get("handle", "")
    category = (d.get("product_type") or d.get("type") or "").strip()
    images = d.get("images") or []
    first_image = _img(images[0] if images else d.get("featured_image"))

    groups: dict[str, list[dict]] = {}
    for v in variants:
        color = (v.get(f"option{color_pos}") if color_pos else "") or ""
        groups.setdefault(color, []).append(v)
    split = len(groups) > 1

    out: list[Product] = []
    for color, vs in groups.items():
        sizes: dict[str, bool] = {}
        size_variants: dict[str, str] = {}
        for v in vs:
            size = v.get(f"option{size_pos}") if size_pos else None
            if not size:
                continue
            sizes[size] = sizes.get(size, False) or bool(v.get("available"))
            if v.get("available") or size not in size_variants:  # prefer an in-stock variant
                size_variants[size] = str(v["id"])
        prices = []
        for v in vs:
            try:
                prices.append(float(v["price"]) / (100 if cents else 1))
            except (KeyError, TypeError, ValueError):
                pass
        image = next((_img(v.get("featured_image")) for v in vs if v.get("featured_image")), "") or first_image
        pick = next((v for v in vs if v.get("available")), vs[0])
        name = title
        if color and slug(color) not in slug(title):
            name = f"{title} · {color}"
        url = f"{base}/products/{handle}" + (f"?variant={pick['id']}" if split else "")
        out.append(Product(
            pid=f"{d['id']}-{slug(color)}" if split else str(d["id"]),
            name=name, price=f"{min(prices):.2f}" if prices else "", category=category, url=url,
            image=image, sizes=sizes, size_labels={s: s for s in sizes},
            available=any(v.get("available") for v in vs), store=store, size_variants=size_variants,
        ))
    return out


def colors_of(d: dict) -> list[str]:
    _, pos = _positions(d.get("options"))
    if not pos:
        return []
    return list(dict.fromkeys(v.get(f"option{pos}") for v in d.get("variants") or [] if v.get(f"option{pos}")))


def fetch_catalogue(client: Client, base: str, store: str, max_pages: int = 8) -> tuple[list[Product], list[dict]]:
    """(products, raw product dicts) from products.json, every page until an empty one."""
    out: dict[str, Product] = {}
    raw: list[dict] = []
    for page in range(1, max_pages + 1):
        body = client.get(f"{base}/products.json?limit={PAGE_LIMIT}&page={page}")
        try:
            items = json.loads(body or "{}").get("products") or []
        except ValueError:
            raise FetchError(f"{base}/products.json", None, "JSON이 아님 (점검 중이거나 차단됨)") from None
        for d in items:
            raw.append(d)
            for p in parse_products(base, d, store):
                out[p.pid] = p
        if not items:  # a page can hold fewer than the limit and still not be the last
            break
    return list(out.values()), raw


def fetch_products(client: Client, base: str, store: str, max_pages: int = 8) -> list[Product]:
    return fetch_catalogue(client, base, store, max_pages)[0]


def home_handles(client: Client, base: str) -> list[str]:
    """Product handles the home page links to."""
    body = client.get(f"{base}/")
    return list(dict.fromkeys(re.findall(r"/products/([a-z0-9][a-z0-9-]*)", body or "")))


def fetch_js(client: Client, base: str, handle: str) -> dict | None:
    """The raw /products/<handle>.js product, or None when the handle doesn't exist (404)."""
    try:
        body = client.get(f"{base}/products/{urllib.parse.quote(handle)}.js")
    except FetchError as e:
        if e.status == 404:
            return None
        raise
    try:
        d = json.loads(body)
    except ValueError:
        return None
    return d if isinstance(d, dict) and d.get("id") else None


def fetch_product_js(client: Client, base: str, handle: str, store: str) -> list[Product]:
    d = fetch_js(client, base, handle)
    return parse_products(base, d, store, cents=True) if d else []


TITLES: dict[tuple[str, str], str] = {}  # (store base, collection handle) -> title


def fetch_collections(client: Client, base: str) -> dict[str, int]:
    """{collection handle: product count}; titles go to TITLES"""
    body = client.get(f"{base}/collections.json?limit=250")
    try:
        cols = json.loads(body or "{}").get("collections") or []
    except ValueError:
        raise FetchError(f"{base}/collections.json", None, "JSON이 아님") from None
    for c in cols:
        if c.get("handle") and c.get("title"):
            TITLES[(base, c["handle"])] = html.unescape(c["title"]).strip()
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


def sitemap_handles(client: Client, base: str) -> list[str]:
    """Product handles from the store's sitemap (it sometimes lists products the catalogue hides)."""
    index = client.get(f"{base}/sitemap.xml")
    handles: list[str] = []
    for loc in re.findall(r"<loc>([^<]+sitemap_products[^<]+)</loc>", index):
        body = client.get(html.unescape(loc))
        for h in re.findall(r"<loc>[^<]*/products/([^<?#/]+)</loc>", body):
            if h not in handles:
                handles.append(h)
    return handles
