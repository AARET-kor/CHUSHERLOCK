"""Alert channels: desktop, sound, phone push (ntfy), Telegram, Discord, browser."""

from __future__ import annotations

import json
import logging
import os
import platform
import shutil
import subprocess
import urllib.parse
import urllib.request
import webbrowser

from . import telegram
from .detect import Event
from .site import buy_url

log = logging.getLogger("chmonitor")


def _post(url: str, body: bytes, headers: dict[str, str]) -> None:
    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=15) as r:
        r.read()


class Notifier:
    def __init__(self, cfg: dict):
        self.cfg = cfg

    # -- public

    def send(self, ev: Event) -> None:
        link = self.link(ev)
        body = "\n".join(x for x in [ev.detail, link] if x)
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
                fn(ev, body, link)
            except Exception as e:  # one broken channel must not stop the others
                log.warning("알림 실패 (%s): %s", name, e)
        if self.cfg.get("auto_open_browser") and link and ev.kind in self.cfg.get(
            "auto_open_on", ["new_product", "restock", "category_open"]
        ):
            webbrowser.open(link, new=2)

    def link(self, ev: Event) -> str:
        if ev.product:
            size = self._preferred_size(ev)
            return buy_url(ev.product, size)
        if ev.category:
            return f"https://www.chromehearts.com/{urllib.parse.quote(ev.category)}"
        return ""

    # -- helpers

    def _enabled(self, name: str) -> bool:
        c = self.cfg.get(name)
        return bool(c.get("enabled")) if isinstance(c, dict) else bool(c)

    def _preferred_size(self, ev: Event) -> str | None:
        """First preferred size that is in stock; None opens the page without one."""
        p = ev.product
        if not p:
            return None
        for want in self.cfg.get("preferred_sizes") or []:
            w = str(want).strip().upper()
            for sid, ok in p.sizes.items():
                if ok and w in (sid.upper(), p.size_labels.get(sid, "").upper()):
                    return sid
        return None

    # -- channels

    def _desktop(self, ev: Event, body: str, link: str) -> None:
        system = platform.system()
        if system == "Darwin":
            if shutil.which("terminal-notifier"):
                cmd = ["terminal-notifier", "-title", "Chrome Hearts", "-subtitle", ev.title,
                       "-message", ev.detail or ev.title, "-sound", "Glass"]
                if link:
                    cmd += ["-open", link]
                subprocess.run(cmd, check=False)
            else:
                script = 'display notification {} with title "Chrome Hearts" subtitle {} sound name "Glass"'.format(
                    json.dumps(ev.detail or link), json.dumps(ev.title))
                subprocess.run(["osascript", "-e", script], check=False)
        elif system == "Linux" and shutil.which("notify-send"):
            subprocess.run(["notify-send", "-u", "critical", f"Chrome Hearts · {ev.title}", body], check=False)
        elif system == "Windows":
            ps = (
                "[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType=WindowsRuntime] | Out-Null;"
                "$t=[Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02);"
                "$x=$t.GetElementsByTagName('text');$x.Item(0).AppendChild($t.CreateTextNode($env:CH_T))|Out-Null;"
                "$x.Item(1).AppendChild($t.CreateTextNode($env:CH_B))|Out-Null;"
                "[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('Chrome Hearts Monitor').Show([Windows.UI.Notifications.ToastNotification]::new($t))"
            )
            subprocess.run(["powershell", "-NoProfile", "-Command", ps], check=False,
                           env={**os.environ, "CH_T": ev.title, "CH_B": body})

    def _sound(self, ev: Event, body: str, link: str) -> None:
        system = platform.system()
        if system == "Darwin":
            subprocess.Popen(["afplay", "/System/Library/Sounds/Glass.aiff"])
        elif system == "Windows":
            import winsound  # type: ignore
            winsound.MessageBeep()
        else:
            print("\a", end="", flush=True)

    def _ntfy(self, ev: Event, body: str, link: str) -> None:
        c = self.cfg["ntfy"]
        server = c.get("server", "https://ntfy.sh").rstrip("/")
        msg = {
            "topic": c["topic"],
            "title": f"Chrome Hearts · {ev.title}",
            "message": ev.detail or ev.title,
            "priority": int(c.get("priority", 5)),
            "tags": ["rotating_light"],
        }
        if link:
            msg["click"] = link
            msg["actions"] = [{"action": "view", "label": "🛒 바로 구매", "url": link}]
        if ev.product and ev.product.image:
            msg["attach"] = ev.product.image
        _post(server, json.dumps(msg).encode("utf-8"), {"Content-Type": "application/json"})

    def _telegram(self, ev: Event, body: str, link: str) -> None:
        c = self.cfg["telegram"]
        image = ev.product.image if ev.product else ""
        telegram.send_alert(c["bot_token"], str(c["chat_id"]), ev.title, ev.detail, link, image)

    def _discord(self, ev: Event, body: str, link: str) -> None:
        c = self.cfg["discord"]
        embed = {"title": ev.title, "description": ev.detail or "", "color": 0x111111}
        if link:
            embed["url"] = link
        if ev.product and ev.product.image:
            embed["thumbnail"] = {"url": ev.product.image}
        content = f"<@{c['mention_user_id']}>" if c.get("mention_user_id") else ""
        _post(c["webhook_url"], json.dumps({"content": content + " " + link, "embeds": [embed]}).encode(),
              {"Content-Type": "application/json", "User-Agent": "chmonitor/1.0"})
