"""Alert channels: desktop, sound, phone push (ntfy), Telegram, Discord, browser.

Every message is written in Korean. Product names stay as the store spells
them (they are the official names, and searching the store needs them).
"""

from __future__ import annotations

import html
import json
import logging
import os
import platform
import shutil
import subprocess
import urllib.request
from datetime import datetime, timedelta, timezone
import webbrowser
from dataclasses import dataclass, field

from . import fx, telegram
from .detect import Event
from .groups import HOODIE, LABELS, classify, ko_category
from .stores import get as get_store

log = logging.getLogger("chmonitor")

KIND = {
    "new_product": "신상품", "relisted": "재입고 (다시 올라옴)", "restock": "재입고",
    "category_open": "오픈", "price_change": "가격 변경", "test": "테스트 알림", "error": "모니터 오류",
}


def _post(url: str, body: bytes, headers: dict[str, str]) -> None:
    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=15) as r:
        r.read()


KST = timezone(timedelta(hours=9))  # Korea has no daylight saving


def _clock() -> str:
    t = datetime.now(KST).timetuple()
    ampm = "오전" if t.tm_hour < 12 else "오후"
    h = t.tm_hour % 12 or 12
    return f"{t.tm_mon}월 {t.tm_mday}일 {ampm} {h}:{t.tm_min:02d}"


@dataclass
class Message:
    """One alert, ready for any channel."""
    headline: str                 # 🔥 [SKYLRK] 후디 신상품
    title: str                    # product name or collection
    lines: list[str] = field(default_factory=list)
    buttons: list[tuple[str, str]] = field(default_factory=list)  # (label, url)
    image: str = ""

    def text(self) -> str:
        return "\n".join([self.headline, self.title, *self.lines])

    def html(self) -> str:
        e = html.escape
        return "\n".join([f"<b>{e(self.headline)}</b>", f"<b>{e(self.title)}</b>", *[e(x) for x in self.lines]])


class Notifier:
    def __init__(self, cfg: dict):
        self.cfg = cfg

    # -- public

    def send(self, ev: Event) -> None:
        link = self.link(ev)
        msg = self.message(ev, link)
        for name, fn in [
            ("desktop", self._desktop),
            ("sound", self._sound),
            ("ntfy", self._ntfy),
            ("telegram", self._telegram),
            ("discord", self._discord),
        ]:
            if not self._enabled(name):
                continue
            try:
                fn(msg, link)
            except Exception as e:  # one broken channel must not stop the others
                log.warning("알림 실패 (%s): %s", name, e)
        if self.cfg.get("auto_open_browser") and link and ev.kind in self.cfg.get(
            "auto_open_on", ["new_product", "restock", "category_open"]
        ):
            webbrowser.open(link, new=2)

    def link(self, ev: Event) -> str:
        store = get_store(ev.store or (ev.product.store if ev.product else ""))
        if ev.product:
            return store.buy_url(ev.product, self.preferred_size(ev.product))
        if ev.category:
            return store.category_url(ev.category)
        return ""

    def preferred_size(self, p) -> str | None:
        """First preferred size that is in stock; None opens the page without one."""
        for want in self.cfg.get("preferred_sizes") or []:
            w = str(want).strip().upper()
            for sid, ok in p.sizes.items():
                if ok and w in (sid.upper(), p.size_labels.get(sid, "").upper()):
                    return sid
        return None

    def message(self, ev: Event, link: str) -> Message:
        store = get_store(ev.store or (ev.product.store if ev.product else ""))
        p = ev.product
        group = classify(p.name, p.category) if p else classify(ev.category.replace("-", " "))
        what = {HOODIE: "후디"}.get(group, "")
        kind = KIND.get(ev.kind, ev.kind)
        if ev.kind == "category_open":
            kind = f"새 {store.category_word} 오픈"
        icon = {"restock": "📦", "price_change": "💲", "test": "🧪", "error": "⚠️"}.get(
            ev.kind, "🔥" if group == HOODIE else "🚨")
        headline = f"{icon} [{store.name}] " + (f"{what} {kind}" if what and p else kind)

        if not p:
            name = store.category_title(ev.category) if ev.category else ev.title
            lines = [ev.detail] if ev.detail and ev.kind != "category_open" else []
            if ev.kind == "category_open":
                n = ev.title.rsplit("(", 1)[-1].rstrip(")") if "(" in ev.title else ""
                lines = [f"🗂 상품 {n}" if n else "🗂 새로 열렸습니다", f"🕒 {_clock()} 포착"]
            buttons = [(f"🏬 {store.name} 열기", link)] if link else []
            return Message(headline, name, lines, buttons)

        lines: list[str] = []
        if ev.kind == "price_change" and ev.info.get("old_price"):
            lines.append(f"💵 {fx.fmt(ev.info['old_price'])} → {fx.fmt(p.price)}")
        elif p.price:
            lines.append(f"💵 {fx.fmt(p.price)}")
        in_stock = [p.size_labels.get(s, s) for s, ok in p.sizes.items() if ok]
        sold_out = [p.size_labels.get(s, s) for s, ok in p.sizes.items() if not ok]
        if ev.kind == "restock" and ev.info.get("sizes_back"):
            lines.append("📏 다시 들어온 사이즈: " + " · ".join(p.size_labels.get(s, s) for s in ev.info["sizes_back"]))
        elif in_stock:
            lines.append("📏 재고 있음: " + " · ".join(in_stock) + (f"  (품절: {' · '.join(sold_out)})" if sold_out else ""))
        elif p.sizes:
            lines.append("📏 전 사이즈 품절")
        lines.append(f"🏷 {ko_category(p.category) or '-'} · {LABELS.get(group, group)}")
        lines.append(f"🕒 {_clock()} 포착")

        size = self.preferred_size(p)
        buttons = []
        if link:
            if size and "/cart/" in link:
                label = f"🛒 {p.size_labels.get(size, size)} 사이즈 바로 결제"
            elif size:
                label = f"🛒 바로 구매 ({p.size_labels.get(size, size)} 선택됨)"
            else:
                label = "🛒 상품 페이지 열기"
            buttons.append((label, link))
            if p.url and p.url != link:
                buttons.append(("👀 상품 보기", p.url))
        return Message(headline, p.name, lines, buttons, p.image)

    # -- helpers

    def _enabled(self, name: str) -> bool:
        c = self.cfg.get(name)
        return bool(c.get("enabled")) if isinstance(c, dict) else bool(c)

    # -- channels

    def _desktop(self, m: Message, link: str) -> None:
        system = platform.system()
        sub, body = m.headline, f"{m.title} · {m.lines[0] if m.lines else ''}"
        if system == "Darwin":
            if shutil.which("terminal-notifier"):
                cmd = ["terminal-notifier", "-title", "드롭 모니터", "-subtitle", sub, "-message", body, "-sound", "Glass"]
                if link:
                    cmd += ["-open", link]
                subprocess.run(cmd, check=False)
            else:
                script = 'display notification {} with title "드롭 모니터" subtitle {} sound name "Glass"'.format(
                    json.dumps(body), json.dumps(sub))
                subprocess.run(["osascript", "-e", script], check=False)
        elif system == "Linux" and shutil.which("notify-send"):
            subprocess.run(["notify-send", "-u", "critical", sub, f"{body}\n{link}"], check=False)
        elif system == "Windows":
            ps = (
                "[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType=WindowsRuntime] | Out-Null;"
                "$t=[Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02);"
                "$x=$t.GetElementsByTagName('text');$x.Item(0).AppendChild($t.CreateTextNode($env:CH_T))|Out-Null;"
                "$x.Item(1).AppendChild($t.CreateTextNode($env:CH_B))|Out-Null;"
                "[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('Drop Monitor').Show([Windows.UI.Notifications.ToastNotification]::new($t))"
            )
            subprocess.run(["powershell", "-NoProfile", "-Command", ps], check=False,
                           env={**os.environ, "CH_T": sub, "CH_B": body})

    def _sound(self, m: Message, link: str) -> None:
        system = platform.system()
        if system == "Darwin":
            subprocess.Popen(["afplay", "/System/Library/Sounds/Glass.aiff"])
        elif system == "Windows":
            import winsound  # type: ignore
            winsound.MessageBeep()
        else:
            print("\a", end="", flush=True)

    def _ntfy(self, m: Message, link: str) -> None:
        c = self.cfg["ntfy"]
        server = c.get("server", "https://ntfy.sh").rstrip("/")
        msg = {"topic": c["topic"], "title": m.headline, "message": "\n".join([m.title, *m.lines]),
               "priority": int(c.get("priority", 5)), "tags": ["rotating_light"]}
        if link:
            msg["click"] = link
            msg["actions"] = [{"action": "view", "label": label, "url": url} for label, url in m.buttons[:3]]
        if m.image:
            msg["attach"] = m.image
        _post(server, json.dumps(msg).encode("utf-8"), {"Content-Type": "application/json"})

    def _telegram(self, m: Message, link: str) -> None:
        c = self.cfg["telegram"]
        telegram.send_message(c["bot_token"], str(c["chat_id"]), m.html(), m.buttons, m.image)

    def _discord(self, m: Message, link: str) -> None:
        c = self.cfg["discord"]
        embed = {"title": m.title, "description": "\n".join(m.lines), "color": 0x111111, "author": {"name": m.headline}}
        if link:
            embed["url"] = link
        if m.image:
            embed["thumbnail"] = {"url": m.image}
        content = f"<@{c['mention_user_id']}>" if c.get("mention_user_id") else ""
        _post(c["webhook_url"], json.dumps({"content": f"{content} {link}".strip(), "embeds": [embed]}).encode(),
              {"Content-Type": "application/json", "User-Agent": "chmonitor/1.0"})
