"""USD -> KRW for showing prices in won.

The store sells in USD. The won figure is a plain conversion at the current
rate (not Chrome Hearts Korea's own price), refreshed every 6 hours from a
free, keyless rates API. If that fails the last good rate is kept; with none,
the configured fallback is used and marked as such.
"""

from __future__ import annotations

import json
import logging
import threading
import time
import urllib.request

log = logging.getLogger("chmonitor")

RATES_URL = "https://open.er-api.com/v6/latest/USD"
REFRESH_SECONDS = 6 * 3600
DEFAULT_RATE = 1400.0

_lock = threading.Lock()
_state = {"rate": DEFAULT_RATE, "source": "default", "updated": None, "checked": 0.0}


def configure(fallback: float | None = None, fixed: float | None = None) -> None:
    """fixed: always use this rate. fallback: rate to show until one is fetched."""
    with _lock:
        if fixed:
            _state.update(rate=float(fixed), source="config", updated=None, checked=float("inf"))
        elif fallback and _state["source"] == "default":
            _state["rate"] = float(fallback)


def parse(body: dict) -> float:
    rate = float(body["rates"]["KRW"])
    if not 100 < rate < 10000:
        raise ValueError(f"implausible USD/KRW rate {rate}")
    return rate


def refresh(force: bool = False, timeout: float = 10) -> None:
    with _lock:
        if not force and time.time() - _state["checked"] < REFRESH_SECONDS:
            return
        _state["checked"] = time.time()
    try:
        req = urllib.request.Request(RATES_URL, headers={"User-Agent": "chmonitor/1.0"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            rate = parse(json.loads(r.read().decode("utf-8")))
    except Exception as e:  # keep the previous rate
        log.info("환율을 받지 못해 %s 값을 씁니다 (%s)", "이전" if _state["source"] == "live" else "기본", e)
        with _lock:  # try again in 30 minutes rather than 6 hours
            _state["checked"] = time.time() - REFRESH_SECONDS + 1800
        return
    with _lock:
        _state.update(rate=rate, source="live", updated=time.strftime("%Y-%m-%dT%H:%M:%S"))


def info() -> dict:
    with _lock:
        return dict(_state, checked=None)


def usd(price: str | float | None) -> float | None:
    try:
        return float(str(price).replace(",", "").replace("$", ""))
    except (TypeError, ValueError):
        return None


def krw(price: str | float | None) -> int | None:
    v = usd(price)
    if v is None:
        return None
    won = v * info()["rate"]
    return int(round(won, -3 if won >= 100000 else -2))  # ₩3,675,000 not ₩3,674,812


def fmt(price: str | float | None) -> str:
    """'$2,625 (≈ ₩3,675,000)'"""
    v = usd(price)
    if v is None:
        return ""
    d = f"${v:,.0f}" if v == int(v) else f"${v:,.2f}"
    return f"{d} (≈ ₩{krw(v):,})"
