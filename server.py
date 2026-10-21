"""Serve the dashboard and weather_data.json using Python's built-in web server."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent


class DashboardHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        if self.path == "/":
            self.path = "/static/index.html"
        super().do_GET()


if __name__ == "__main__":
    print("Dashboard: http://localhost:8000")
    ThreadingHTTPServer(("127.0.0.1", 8000), DashboardHandler).serve_forever()
