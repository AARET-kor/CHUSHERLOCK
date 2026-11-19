"""Compare two snapshots of the store and describe what changed."""

from __future__ import annotations

from dataclasses import dataclass

from .site import Product


@dataclass
class Event:
    kind: str  # new_product | relisted | restock | category_open | price_change
    title: str
    product: Product | None = None
    category: str = ""
    detail: str = ""


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


def diff_categories(old: dict[str, int], new: dict[str, int]) -> list[Event]:
    return diff({}, {}, old, new)


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
        if old.price and p.price and old.price != p.price:
            events.append(
                Event("price_change", f"가격 변경: {p.name}", product=p,
                      detail=f"${old.price} → ${p.price}")
            )
        back = sorted(s for s, ok in p.sizes.items() if ok and not old.sizes.get(s, False))
        if old.available is False and p.available:
            events.append(Event("restock", f"재입고: {p.name}", product=p, detail=_sizes(p)))
        elif back and old.sizes:
            events.append(
                Event("restock", f"재입고: {p.name}", product=p,
                      detail="사이즈 " + ", ".join(p.size_labels.get(s, s) for s in back))
            )
    return events


def _price(p: Product) -> str:
    parts = [f"${p.price}" if p.price else "", p.category]
    return " · ".join(x for x in parts if x)


def _sizes(p: Product) -> str:
    ok = [p.size_labels.get(s, s) for s, v in p.sizes.items() if v]
    return ("사이즈 " + ", ".join(ok)) if ok else ""
