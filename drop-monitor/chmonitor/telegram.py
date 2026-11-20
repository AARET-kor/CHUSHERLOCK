"""Telegram Bot API: sending alerts and the one-time interactive setup."""

from __future__ import annotations

import getpass
import html
import json
import shutil
import time
import urllib.error
import urllib.request
from pathlib import Path

API = "https://api.telegram.org"


class TelegramError(Exception):
    pass


def call(token: str, method: str, payload: dict | None = None, timeout: float = 20) -> dict:
    """POST to the Bot API. Raises TelegramError with Telegram's own description."""
    data = json.dumps(payload or {}).encode("utf-8")
    req = urllib.request.Request(f"{API}/bot{token}/{method}", data=data,
                                 headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            body = json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        try:
            desc = json.loads(e.read().decode("utf-8")).get("description", e.reason)
        except ValueError:
            desc = e.reason
        raise TelegramError(f"{method}: {e.code} {desc}") from None
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        # never echo the URL: it contains the bot token
        raise TelegramError(f"{method}: 연결 실패 ({getattr(e, 'reason', e)})") from None
    if not body.get("ok"):
        raise TelegramError(f"{method}: {body.get('description', 'unknown error')}")
    return body["result"]


def send_alert(token: str, chat_id: str, title: str, detail: str, link: str, image: str = "") -> None:
    text = f"🚨 <b>{html.escape(title)}</b>"
    if detail:
        text += f"\n{html.escape(detail)}"
    markup = {"inline_keyboard": [[{"text": "🛒 바로 구매", "url": link}]]} if link else None
    base = {"chat_id": chat_id, "parse_mode": "HTML"}
    if markup:
        base["reply_markup"] = markup
    if image:
        try:
            call(token, "sendPhoto", {**base, "photo": image, "caption": text})
            return
        except TelegramError:
            pass  # image unreachable for Telegram: fall back to text
    call(token, "sendMessage", {**base, "text": text, "disable_web_page_preview": not link})


def wait_for_chat(token: str, seconds: int = 120) -> dict | None:
    """Long-poll getUpdates until someone writes to the bot. Returns that chat."""
    offset = None
    # skip messages sent before setup started
    old = call(token, "getUpdates", {"timeout": 0})
    if old:
        offset = old[-1]["update_id"] + 1
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        payload = {"timeout": 25, "allowed_updates": ["message"]}
        if offset is not None:
            payload["offset"] = offset
        for upd in call(token, "getUpdates", payload, timeout=35):
            offset = upd["update_id"] + 1
            msg = upd.get("message") or {}
            if msg.get("chat", {}).get("id") is not None:
                call(token, "getUpdates", {"offset": offset, "timeout": 0})  # acknowledge
                return msg["chat"]
    return None


def save_config(config_path: Path, token: str, chat_id: str) -> None:
    if config_path.exists():
        cfg = json.loads(config_path.read_text(encoding="utf-8"))
    else:
        example = Path(__file__).resolve().parent.parent / "config.example.json"
        cfg = json.loads(example.read_text(encoding="utf-8")) if example.exists() else {}
    tg = cfg.get("telegram") or {}
    tg.update({"enabled": True, "bot_token": token, "chat_id": str(chat_id)})
    cfg["telegram"] = tg
    tmp = config_path.with_suffix(".tmp")
    tmp.write_text(json.dumps(cfg, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    try:
        tmp.chmod(0o600)  # holds the bot token
    except OSError:
        pass
    shutil.move(str(tmp), str(config_path))


def setup(config_path: str) -> int:
    path = Path(config_path)
    print("텔레그램 알림 설정\n")
    print("1) 텔레그램에서 @BotFather 를 열고 /newbot 을 보내 봇을 만드세요.")
    print("   BotFather가 알려 주는 토큰(예: 123456789:AA...)을 아래에 붙여 넣으세요.")
    print("   (입력한 글자는 화면에 보이지 않습니다.)\n")
    token = getpass.getpass("봇 토큰: ").strip()
    if ":" not in token:
        print("토큰 형식이 아닙니다. 숫자:문자 형태여야 합니다.")
        return 1
    try:
        me = call(token, "getMe")
    except TelegramError as e:
        print(f"토큰 확인 실패: {e}")
        return 1
    username = me.get("username", "")
    print(f"\n✓ 봇 확인: @{username}")
    print(f"\n2) 휴대폰 텔레그램에서 https://t.me/{username} 을 열고 [시작] 또는 아무 메시지나 보내세요.")
    print("   (그룹으로 받으려면 봇을 그룹에 초대하고 그룹에서 메시지를 보내세요.) 2분 기다립니다…")
    try:
        chat = wait_for_chat(token)
    except TelegramError as e:
        print(f"메시지 확인 실패: {e}")
        return 1
    if not chat:
        print("2분 동안 메시지가 오지 않았습니다. 다시 실행해 주세요.")
        return 1
    who = chat.get("title") or chat.get("first_name") or chat.get("username") or chat["id"]
    print(f"✓ 대화 확인: {who} (chat_id {chat['id']})")
    save_config(path, token, chat["id"])
    print(f"✓ {path} 에 저장했습니다 (telegram.enabled = true)")
    try:
        send_alert(token, chat["id"], "Chrome Hearts 모니터 연결 완료",
                   "새 드롭이 뜨면 여기로 알림이 옵니다.", "https://www.chromehearts.com/")
        print("✓ 테스트 메시지를 보냈습니다. 텔레그램을 확인하세요.")
    except TelegramError as e:
        print(f"테스트 메시지 실패: {e}")
        return 1
    return 0
