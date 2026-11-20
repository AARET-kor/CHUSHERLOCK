"""Compare two snapshots of the store and describe what changed."""

from __future__ import annotations

from dataclasses import dataclass, field

from . import fx
from .groups import ko_category
from .site import Product


@dataclass
class Event:
    kind: str  # new_product | relisted | restock | category_open | price_change
    title: str
    product: Product | None = None
    category: str = ""
    detail: str = ""
    store: str = ""
    info: dict = field(default_factory=dict)  # e.g. {"sizes_back": [...], "old_price": "..."}

    def __post_init__(self):
        if not self.store and self.product:
            self.store = self.product.store


def matches(product: Product, keywords: list[str]) -> bool:
    if not keywords:
        return True
    hay = f"{product.name} {product.category} {product.pid}".lower()
    return any(k.lower() in hay for k in keywords)


def diff(
    old_products: dict[str, Product],
    new_products: dict[str, Product],
    old_categories: dict[str, int],
    new_categories: dict[str, int],
    keywords: list[str] | None = None,
) -> list[Event]:
    keywords = keywords or []
    events: list[Event] = []

    for cg, n in new_categories.items():
        if n > 0 and old_categories.get(cg, 0) == 0:
            events.append(Event("category_open", f"카테고리 오픈: {cg} ({n}개)", category=cg))

    events.extend(diff_products(old_products, new_products, keywords))
    return events


def diff_categories(old: dict[str, int], new: dict[str, int], store: str = "", word: str = "카테고리") -> list[Event]:
    return [Event("category_open", f"{word} 오픈: {cg} ({n}개)", category=cg, store=store)
            for cg, n in new.items() if n > 0 and old.get(cg, 0) == 0]


def diff_products(
    old_products: dict[str, Product], new_products: dict[str, Product], keywords: list[str] | None = None
) -> list[Event]:
    keywords = keywords or []
    events: list[Event] = []
    for pid, p in new_products.items():
        if not matches(p, keywords):
            continue
        old = old_products.get(pid)
        if not p.listed:
            continue
        if old is None:
            events.append(Event("new_product", f"신상품: {p.name}", product=p, detail=_price(p)))
            continue
        if not old.listed:
            events.append(Event("relisted", f"재등록: {p.name}", product=p, detail=_price(p)))
            continue
        if old.price and p.price and fx.usd(old.price) != fx.usd(p.price):
            events.append(
                Event("price_change", f"가격 변경: {p.name}", product=p,
                      detail=f"{fx.fmt(old.price)} → {fx.fmt(p.price)}", info={"old_price": old.price})
            )
        back = sorted(s for s, ok in p.sizes.items() if ok and not old.sizes.get(s, False))
        if old.available is False and p.available:
            events.append(Event("restock", f"재입고: {p.name}", product=p, detail=_sizes(p)))
        elif back and old.sizes:
            events.append(
                Event("restock", f"재입고: {p.name}", product=p,
                      detail="사이즈 " + ", ".join(p.size_labels.get(s, s) for s in back),
                      info={"sizes_back": back})
            )
    return events


def _price(p: Product) -> str:
    parts = [fx.fmt(p.price) if p.price else "", ko_category(p.category)]
    return " · ".join(x for x in parts if x)


def _sizes(p: Product) -> str:
    ok = [p.size_labels.get(s, s) for s, v in p.sizes.items() if v]
    return ("사이즈 " + ", ".join(ok)) if ok else ""
