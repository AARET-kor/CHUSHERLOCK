import json
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path
from unittest import mock

from chmonitor import telegram
from chmonitor.dashboard import make_handler
from chmonitor.monitor import Monitor, load_config
from tests.test_monitor import FakeClient, RecordingNotifier, tile


class TelegramTests(unittest.TestCase):
    def test_alert_sends_photo_with_buy_button(self):
        calls = []
        with mock.patch.object(telegram, "call", side_effect=lambda t, m, p=None, **k: calls.append((m, p))):
            telegram.send_alert("T", "42", "신상품: <HOODIE>", "$1,450", "https://x/buy", "https://x/img.png")
        method, payload = calls[0]
        self.assertEqual(method, "sendPhoto")
        self.assertEqual(payload["chat_id"], "42")
        self.assertIn("&lt;HOODIE&gt;", payload["caption"])  # HTML-escaped
        self.assertEqual(payload["reply_markup"]["inline_keyboard"][0][0]["url"], "https://x/buy")

    def test_alert_falls_back_to_text_when_photo_fails(self):
        calls = []

        def fake(t, m, p=None, **k):
            calls.append(m)
            if m == "sendPhoto":
                raise telegram.TelegramError("bad photo")

        with mock.patch.object(telegram, "call", side_effect=fake):
            telegram.send_alert("T", "42", "t", "", "https://x", "https://x/i.png")
        self.assertEqual(calls, ["sendPhoto", "sendMessage"])

    def test_wait_for_chat_skips_old_messages(self):
        responses = [
            [{"update_id": 5, "message": {"chat": {"id": 1}}}],      # old backlog
            [{"update_id": 6, "message": {"chat": {"id": 777, "first_name": "A"}}}],
            [],                                                      # acknowledge
        ]
        seen = []

        def fake(t, m, p=None, **k):
            seen.append(p)
            return responses.pop(0)

        with mock.patch.object(telegram, "call", side_effect=fake):
            chat = telegram.wait_for_chat("T", seconds=5)
        self.assertEqual(chat["id"], 777)
        self.assertEqual(seen[1]["offset"], 6)

    def test_save_config_keeps_other_settings(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "config.json"
            p.write_text(json.dumps({"keywords": ["hoodie"], "telegram": {"enabled": False}}))
            telegram.save_config(p, "1:ABC", 777)
            cfg = json.loads(p.read_text())
        self.assertEqual(cfg["keywords"], ["hoodie"])
        self.assertEqual(cfg["telegram"], {"enabled": True, "bot_token": "1:ABC", "chat_id": "777"})


class DashboardTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        cfg = load_config(None)
        cfg["state_file"] = str(Path(self.tmp.name) / "s.json")
        cfg["telegram"].update(enabled=True, bot_token="SECRET-TOKEN", chat_id="1")
        self.notifier = RecordingNotifier(cfg)
        self.mon = Monitor(cfg, client=FakeClient({"root": tile("A", "CEMETERY HOODIE")}), notifier=self.notifier)
        self.mon.check()
        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(self.mon))
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()
        self.base = f"http://127.0.0.1:{self.httpd.server_port}"

    def tearDown(self):
        self.httpd.shutdown()
        self.httpd.server_close()
        self.tmp.cleanup()

    def req(self, path, method="GET", headers=None):
        r = urllib.request.Request(self.base + path, method=method, headers=headers or {}, data=b"" if method == "POST" else None)
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        try:
            with opener.open(r, timeout=5) as resp:
                return resp.status, resp.read().decode()
        except urllib.error.HTTPError as e:
            return e.code, e.read().decode()

    def test_state_has_products_and_no_secrets(self):
        code, body = self.req("/api/state")
        self.assertEqual(code, 200)
        d = json.loads(body)
        self.assertEqual(d["products"][0]["name"], "CEMETERY HOODIE")
        self.assertTrue(d["products"][0]["buy_url"].endswith("/A.html"))
        self.assertTrue(d["config"]["channels"]["telegram"])
        self.assertNotIn("SECRET-TOKEN", body)

    def test_page_served(self):
        code, body = self.req("/")
        self.assertEqual(code, 200)
        self.assertIn("Drop Monitor", body)

    def test_actions_need_header(self):
        self.assertEqual(self.req("/api/test-notify", "POST")[0], 403)
        self.assertEqual(self.req("/api/test-notify", "POST", {"X-CH-Dashboard": "1"})[0], 200)

    def test_foreign_host_rejected(self):
        self.assertEqual(self.req("/api/state", headers={"Host": "evil.example"})[0], 403)

    def test_check_now_wakes_loop(self):
        self.mon._wake.clear()
        self.req("/api/check", "POST", {"X-CH-Dashboard": "1"})
        self.assertTrue(self.mon._wake.is_set())


if __name__ == "__main__":
    unittest.main()
