"""Priority alerts: the few items worth dropping everything for.

A rule names a store, product groups and sizes. When a new, relisted or
restocked product of those groups has one of those sizes in stock, the alert
is marked priority: louder headline, the buy link opens with that size
already selected, and Telegram repeats it a couple of times.

Default: Chrome Hearts hoodies and zip-up hoodies in M or XL.
"""

from __future__ import annotations

from .detect import Event
from .groups import classify

DEFAULT_RULES = [
    {"store": "chromehearts", "groups": ["hoodie"], "sizes": ["M", "XL"], "repeat": 2, "repeat_every": 20},
]
KINDS = ("new_product", "relisted", "restock")


def _size_ids(p, wanted: list[str], among: list[str] | None = None) -> list[str]:
    """Size ids of p that are in stock and match `wanted` (by label or id), in `wanted` order."""
    out = []
    for want in wanted:
        w = str(want).strip().upper()
        for sid, ok in p.sizes.items():
            if not ok or (among is not None and sid not in among):
                continue
            if w in (sid.upper(), p.size_labels.get(sid, "").upper()) and sid not in out:
                out.append(sid)
    return out


def rule_for(ev: Event, rules: list[dict], store_id: str) -> dict | None:
    """The first rule this event satisfies, with the matching sizes filled in."""
    p = ev.product
    if not p or ev.kind not in KINDS:
        return None
    group = classify(p.name, p.category)
    for r in rules or []:
        if r.get("store", store_id) != store_id or group not in (r.get("groups") or ["hoodie"]):
            continue
        # a restock only counts when one of *our* sizes is the one that came back
        among = ev.info.get("sizes_back") if ev.kind == "restock" else None
        hits = _size_ids(p, r.get("sizes") or [], among)
        if hits:
            return {**r, "size": hits[0], "hits": [p.size_labels.get(s, s) for s in hits]}
    return None


def mark(ev: Event, rules: list[dict], store_id: str) -> bool:
    r = rule_for(ev, rules, store_id)
    if not r:
        return False
    ev.info.update(priority=True, size=r["size"], hits=r["hits"],
                   repeat=int(r.get("repeat", 2)), repeat_every=float(r.get("repeat_every", 20)))
    return True


def live_hits(p, rules: list[dict], store_id: str) -> list[str]:
    """Sizes of a product currently on sale that a rule wants (for the dashboard badge)."""
    if not p.listed:
        return []
    group = classify(p.name, p.category)
    for r in rules or []:
        if r.get("store", store_id) == store_id and group in (r.get("groups") or ["hoodie"]):
            hits = _size_ids(p, r.get("sizes") or [])
            if hits:
                return [p.size_labels.get(s, s) for s in hits]
    return []
