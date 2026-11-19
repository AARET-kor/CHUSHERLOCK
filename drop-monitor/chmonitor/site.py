"""Reading chromehearts.com (Salesforce Commerce Cloud storefront).

Endpoints used (all public, the same ones the storefront's own pages call):
  - /sitemap_0.xml                          -> list of category pages
  - Search-UpdateGrid?cgid=<id>&start=&sz=  -> product tiles, 12 per page
  - Product-Variation?pid=<id>[&dwvar_...]  -> JSON with per-size stock
"""

from __future__ import annotations

import html
import json
import random
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field, asdict

BASE = "https://www.chromehearts.com"
STORE = f"{BASE}/on/demandware.store/Sites-ChromeHearts-Site/en_US"
PAGE_SIZE = 12  # the storefront caps sz at 12
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/130.0 Safari/537.36"
)


class FetchError(Exception):
    def __init__(self, url: str, status: int | None, msg: str):
        super().__init__(f"{status or 'ERR'} {url}: {msg}")
        self.url = url
        self.status = status


@dataclass
class Product:
    pid: str
    name: str
    price: str = ""
    category: str = ""
    url: str = ""
    image: str = ""
    sizes: dict[str, bool] = field(default_factory=dict)  # size id -> in stock
    size_labels: dict[str, str] = field(default_factory=dict)  # size id -> shown label
    available: bool | None = None
    listed: bool = True  # currently shown in the storefront grid

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict) -> "Product":
        known = {k: d[k] for k in cls.__dataclass_fields__ if k in d}
        return cls(**known)


class Client:
    """Polite HTTP client: one request at a time, small random gap between them."""

    def __init__(self, min_gap: float = 0.5, timeout: float = 20.0):
        self.min_gap = min_gap
        self.timeout = timeout
        self._last = 0.0

    def get(self, url: str) -> str:
        wait = self.min_gap + random.uniform(0, 0.3) - (time.monotonic() - self._last)
        if wait > 0:
            time.sleep(wait)
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": USER_AGENT,
                "Accept": "text/html,application/json;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as r:
                body = r.read().decode("utf-8", "replace")
                final = r.geturl()
        except urllib.error.HTTPError as e:
            raise FetchError(url, e.code, e.reason) from None
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            raise FetchError(url, None, str(e)) from None
        finally:
            self._last = time.monotonic()
        # Closed categories redirect to the home page.
        if final.rstrip("/") == BASE and url.rstrip("/") != BASE:
            return ""
        return body


# ---------------------------------------------------------------- parsing

_META_RE = re.compile(r'<span\s+class="product-metadata[^"]*"([^>]*)>', re.S)
_ATTR_RE = re.compile(r'data-([a-z-]+)="([^"]*)"')
_LOC_RE = re.compile(r"<loc>\s*([^<\s]+)\s*</loc>")


def parse_grid(page: str) -> list[Product]:
    """Product tiles from a Search-UpdateGrid / category page."""
    metas = list(_META_RE.finditer(page))
    out: list[Product] = []
    for i, m in enumerate(metas):
        attrs = {k: html.unescape(v) for k, v in _ATTR_RE.findall(m.group(1))}
        pid = attrs.get("pid")
        if not pid:
            continue
        end = metas[i + 1].start() if i + 1 < len(metas) else len(page)
        chunk = page[m.end():end]
        url = ""
        link = re.search(r'href="([^"?#]*/' + re.escape(pid) + r'\.html)', chunk)
        if link:
            url = urllib.parse.urljoin(BASE, html.unescape(link.group(1)))
        image = ""
        img = re.search(r'(https://[^"\s,]+/img_products/[^"\s,?]+)', chunk)
        if img:
            image = img.group(1) + "?sw=600"
        out.append(
            Product(
                pid=pid,
                name=attrs.get("name", pid).strip(),
                price=attrs.get("price", ""),
                category=attrs.get("category", ""),
                url=url,
                image=image,
            )
        )
    return out


def parse_categories(sitemap_xml: str) -> list[str]:
    """Category ids (cgid) from the sitemap, excluding the home/start pages."""
    cgids: list[str] = []
    for loc in _LOC_RE.findall(sitemap_xml):
        q = urllib.parse.urlparse(html.unescape(loc))
        qs = urllib.parse.parse_qs(q.query)
        if "cgid" in qs:
            cg = qs["cgid"][0]
        elif q.path.strip("/") and "demandware.store" not in q.path:
            cg = q.path.strip("/").split("/")[-1]
        else:
            continue
        if cg not in cgids:
            cgids.append(cg)
    return cgids


def parse_variation(data: dict) -> tuple[bool | None, dict[str, bool], dict[str, str]]:
    """(available, {size id: selectable}, {size id: label}) from Product-Variation.

    Size ids (e.g. "LRG") are what the storefront URL needs; labels ("L") are
    what the page shows. On the master product a size is selectable when any
    colour of it can be ordered.
    """
    p = data.get("product") or {}
    sizes: dict[str, bool] = {}
    labels: dict[str, str] = {}
    for attr in p.get("variationAttributes") or []:
        if attr.get("id") == "size":
            for v in attr.get("values") or []:
                sizes[v["id"]] = bool(v.get("selectable"))
                labels[v["id"]] = v.get("displayValue") or v["id"]
    return p.get("available"), sizes, labels


# ---------------------------------------------------------------- fetching

def fetch_category(client: Client, cgid: str, max_pages: int = 20) -> list[Product]:
    seen: dict[str, Product] = {}
    for page in range(max_pages):
        q = urllib.parse.urlencode({"cgid": cgid, "start": page * PAGE_SIZE, "sz": PAGE_SIZE})
        items = parse_grid(client.get(f"{STORE}/Search-UpdateGrid?{q}"))
        new = [p for p in items if p.pid not in seen]
        for p in new:
            seen[p.pid] = p
        if len(items) < PAGE_SIZE or not new:
            break
    return list(seen.values())


def fetch_categories(client: Client) -> list[str]:
    try:
        return parse_categories(client.get(f"{BASE}/sitemap_0.xml"))
    except FetchError:
        return []


def fetch_stock(client: Client, pid: str) -> tuple[bool | None, dict[str, bool], dict[str, str]]:
    q = urllib.parse.urlencode({"pid": pid})
    return parse_variation(json.loads(client.get(f"{STORE}/Product-Variation?{q}") or "{}"))


def buy_url(product: Product, size: str | None = None) -> str:
    """Product page, with the size pre-selected when given."""
    url = product.url or f"{BASE}/search?q={urllib.parse.quote(product.pid)}"
    if size:
        sep = "&" if "?" in url else "?"
        url += sep + urllib.parse.urlencode({f"dwvar_{product.pid}_size": size, "quantity": 1})
    return url
