"""Serve weather and refresh it safely at a configurable interval."""

import json
import os
import subprocess
import sys
import threading
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent
REFRESH_SECONDS = max(60, int(os.getenv("URBANHEAT_REFRESH_SECONDS", "900")))
REFRESH_TIMEOUT_SECONDS = 90
refresh_lock = threading.Lock()
refresh_state_lock = threading.Lock()
refresh_state = {"running": False, "last_attempt_utc": None, "last_success_utc": None,
                 "last_error": None}


def refresh_weather():
    """One refresh at a time; the importer writes JSON atomically."""
    if not refresh_lock.acquire(blocking=False):
        return False
    try:
        with refresh_state_lock:
            refresh_state["running"] = True
            refresh_state["last_attempt_utc"] = datetime.now(timezone.utc).isoformat()
        try:
            result = subprocess.run(
                [sys.executable, str(ROOT / "weather.py")],
                cwd=ROOT, capture_output=True, text=True,
                timeout=REFRESH_TIMEOUT_SECONDS, check=False,
            )
            error = None if result.returncode == 0 else (
                (result.stderr or result.stdout or "Weather ingestion failed").strip()[-400:]
            )
        except (OSError, subprocess.TimeoutExpired) as exc:
            error = str(exc)
        with refresh_state_lock:
            refresh_state["last_error"] = error
            if error is None:
                refresh_state["last_success_utc"] = datetime.now(timezone.utc).isoformat()
        if error:
            print(f"Weather refresh failed: {error}", flush=True)
        else:
            print("Weather refresh succeeded", flush=True)
        return error is None
    finally:
        with refresh_state_lock:
            refresh_state["running"] = False
        refresh_lock.release()


def schedule_refresh(stop_event):
    """Wait between completed refreshes to prevent overlapping processes."""
    while not stop_event.wait(REFRESH_SECONDS):
        refresh_weather()


class DashboardHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        route = urlsplit(self.path).path
        if route == "/refresh-status":
            with refresh_state_lock:
                payload = dict(refresh_state)
            payload["interval_seconds"] = REFRESH_SECONDS
            encoded = json.dumps(payload).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(encoded)))
            self.end_headers()
            self.wfile.write(encoded)
            return
        if route == "/":
            self.path = "/static/index.html"
        super().do_GET()

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()


if __name__ == "__main__":
    print(f"Refresh interval: {REFRESH_SECONDS}s (URBANHEAT_REFRESH_SECONDS)", flush=True)
    refresh_weather()
    stop = threading.Event()
    worker = threading.Thread(target=schedule_refresh, args=(stop,), daemon=True)
    worker.start()
    try:
        print("Dashboard: http://localhost:8000", flush=True)
        ThreadingHTTPServer(("127.0.0.1", 8000), DashboardHandler).serve_forever()
    finally:
        stop.set()
