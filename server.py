"""Serve the dashboard and weather_data.json using Python's built-in web server."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parent


class DashboardHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        if self.path == "/":
            self.path = "/static/index.html"
        super().do_GET()


if __name__ == "__main__":
    # Refresh the real readings before serving the dashboard
    result = subprocess.run([sys.executable, str(ROOT / "weather.py")], cwd=ROOT, check=False)
    if result.returncode:
        print("Weather refresh failed. The dashboard will show unavailable data if readings are old.")
    print("Dashboard: http://localhost:8000")
    ThreadingHTTPServer(("127.0.0.1", 8000), DashboardHandler).serve_forever()
