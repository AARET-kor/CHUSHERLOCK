"""Chrome Hearts hidden links: products that are online but in no category grid.

Chrome Hearts (Salesforce Commerce Cloud) opens any product page from its
product id alone, and Product-Variation?pid=<id> answers with `online` and
stock for any product in the catalogue, even one no category shows. So a
product with online=true that is missing from the root grid is reachable only
by its direct link: a hidden link.

Product ids (176354XXXXXX349: style number, colour, size, suffix) cannot be
guessed, so candidates come from:

  1. links the user adds, and hidden products found before: every check
  2. products the monitor saw on sale before and that left the grid: in rotation
  3. past product pages kept by the Internet Archive, hoodies and tops only:
     fetched once a day by the server, then checked in rotation
"""

from __future__ import annotations

import json
import logging
import re
import threading
import time
import urllib.parse
import urllib.request

from . import site
from .groups import HOODIE, TOP, classify
from .site import Client, FetchError, Product

log = logging.getLogger("chmonitor")

PID_RE = re.compile(r"(?<![0-9A-Z])([0-9]{6}[0-9A-Z]{9})(?![0-9A-Z])")
ARCHIVE_CDX = "https://web.archive.org/cdx/search/cdx"
# category paths Chrome Hearts has used or may use for tops; one small query each
ARCHIVE_PREFIXES = ["hoodie", "hoodies", "zip-up", "sweatshirt", "sweatshirts", "sweats", "t-shirt", "t-shirts",
                    "tees", "tops", "long-sleeve", "thermal", "apparel", "mens", "womens", "clothing", "shop", "new"]
ARCHIVE_EVERY = 24 * 3600
ARCHIVE_RETRY = 2 * 3600
MAX_USER = 100
MAX_FOUND = 80


def pid_from(text: str) -> str | None:
    """'https://www.chromehearts.com/hoodie/x/176354XXXXXX349.html' or '176354XXXXXX349' -> the id."""
    m = PID_RE.search((text or "").upper())
    return m.group(1) if m else None


def parse_archive(rows: list) -> list[dict]:
    """CDX rows (first row is the header) -> [{pid, name}] for hoodies and tops, one per product."""
    out: dict[str, dict] = {}
    for row in rows[1:] if rows and rows[0] == ["original"] else rows:
        url = row[0] if isinstance(row, list) else str(row)
        path = urllib.parse.urlparse(url).path
        m = re.search(r"/([^/]+)/([^/]+)/([0-9]{6}[0-9A-Za-z]{9})\.html$", path)
        if not m:
            continue
        category, slug, pid = m.group(1), m.group(2), m.group(3).upper()
        name = slug.replace("-", " ")
        if classify(name, category.replace("-", " ")) not in (HOODIE, TOP):
            continue
        out.setdefault(pid, {"pid": pid, "name": name.upper(), "category": category})
    # hoodies first: they are what the priority alert is for
    return sorted(out.values(), key=lambda d: classify(d["name"], d["category"]) != HOODIE)


def fetch_archive(timeout: float = 60) -> tuple[list[dict], list[str]]:
    """(candidates, errors) from the Internet Archive, one prefix query per category path."""
    rows: list = []
    errors: list[str] = []
    for prefix in ARCHIVE_PREFIXES:
        q = urllib.parse.urlencode({"url": f"www.chromehearts.com/{prefix}/", "matchType": "prefix",
                                    "output": "json", "fl": "original", "collapse": "urlkey", "limit": 5000})
        req = urllib.request.Request(f"{ARCHIVE_CDX}?{q}", headers={"User-Agent": "chmonitor/1.0 (personal drop monitor)"})
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                data = json.loads(r.read().decode("utf-8") or "[]")
            rows += data[1:] if data and data[0] == ["original"] else data
        except Exception as e:
            errors.append(f"{prefix}: {getattr(e, 'code', '')} {getattr(e, 'reason', e)}".strip())
        time.sleep(1)  # be gentle with the archive
    return parse_archive(rows), errors


def product_from(data: dict) -> Product | None:
    """A Product from Product-Variation JSON when the product is online, else None."""
    p = data.get("product") or {}
    if not p.get("online"):
        return None
    master = p.get("masterProductId") or p.get("id")
    available, sizes, labels = site.parse_variation(data)
    imgs = (p.get("images") or {}).get("large") or []
    url = (p.get("selectedProductUrl") or "").split("?")[0]
    sales = ((p.get("price") or {}).get("sales") or {})
    return Product(
        pid=master, name=(p.get("productName") or master).strip(),
        price=str(sales.get("decimalPrice") or ""), category=str(p.get("primaryCategory") or ""),
        url=urllib.parse.urljoin(site.BASE, url) if url else f"{site.BASE}/x/{master}.html",
        image=(imgs[0].get("url") if imgs else "") or "", sizes=sizes, size_labels=labels,
        available=bool(p.get("available")), hidden=True,
    )


class ChromeHeartsHidden:
    background = True  # tests set False

    def __init__(self, store, state: dict, old_products):
        self.store = store
        self.state = state
        for k, v in (("found", []), ("user", []), ("cursor", 0), ("archive", []), ("archive_at", 0)):
            self.state.setdefault(k, v)
        self.old_products = old_products  # callable -> the monitor's last product dict
        self._fetching = False
        if "archive_note" not in self.state:  # state from a version without the note: ask again now
            self.state["archive_at"] = 0

    def add_user(self, text: str) -> bool:
        pid = pid_from(text)
        if not pid or pid in self.state["user"] or len(self.state["user"]) >= MAX_USER:
            return False
        self.state["user"].append(pid)
        return True

    def refresh_archive(self) -> None:
        wait = ARCHIVE_EVERY if self.state["archive"] else ARCHIVE_RETRY
        if time.time() - self.state["archive_at"] < wait:
            return
        if self._fetching:
            return
        self.state["archive_at"] = time.time()
        self._fetching = True

        def work():  # in the background: the archive is slow and must not hold up the checks
            try:
                found, errors = fetch_archive()
            except Exception as e:
                found, errors = [], [str(e)]
            if found:
                self.state["archive"] = found[:400]
            self.state["archive_note"] = (f"{len(found)}개" + (f", 실패 {len(errors)}건: {errors[0]}" if errors else ""))[:300]
            log.info("[Chrome Hearts] 인터넷 아카이브: 후디·상의 후보 %s", self.state["archive_note"])
            self._fetching = False

        if self.background:
            threading.Thread(target=work, name="archive", daemon=True).start()
        else:
            work()

    def candidates(self, listed_ids: set[str]) -> tuple[list[str], list[str]]:
        """(every check, rotation)"""
        every = [p for p in self.state["user"] + self.state["found"] if p not in listed_ids]
        gone = [pid for pid, p in (self.old_products() or {}).items() if not p.listed and not p.hidden]
        rotation = [pid for pid in gone + [a["pid"] for a in self.state["archive"]]
                    if pid not in listed_ids and pid not in every]
        return list(dict.fromkeys(every)), list(dict.fromkeys(rotation))

    def scan(self, client: Client, listed: list[Product], per_check: int = 8) -> list[Product]:
        self.refresh_archive()
        listed_ids = {p.pid for p in listed}
        every, rotation = self.candidates(listed_ids)
        start = self.state["cursor"] % len(rotation) if rotation else 0
        batch = (rotation[start:] + rotation[:start])[:per_check]
        self.state["cursor"] = start + len(batch)

        out: dict[str, Product] = {}
        for pid in every + batch:
            try:
                body = client.get(f"{site.STORE}/Product-Variation?" + urllib.parse.urlencode({"pid": pid}))
                p = product_from(json.loads(body or "{}"))
            except FetchError as e:
                if e.status == 429:
                    log.warning("[Chrome Hearts] 히든링크 확인 중 429, 이번 회차 중단")
                    break
                continue  # 500 for ids the catalogue doesn't have
            except ValueError:
                continue
            if not p or p.pid in listed_ids:
                continue
            out[p.pid] = p
            if pid not in self.state["found"]:
                self.state["found"].append(pid)
                del self.state["found"][:-MAX_FOUND]
                log.info("[Chrome Hearts] 🔗 히든링크 발견: %s (%s)", p.name, p.url)
        # found ids that went offline stay in `found` but are checked like the rest
        self.state["live"] = len(out)
        return list(out.values())
