"""Check that the national map is the only public homepage."""
import threading
import unittest
from urllib.request import urlopen
from http.server import ThreadingHTTPServer

from server import DashboardHandler


class HomepageRouteTests(unittest.TestCase):
    def test_root_serves_national_map(self):
        server = ThreadingHTTPServer(("127.0.0.1", 0), DashboardHandler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            address = f"http://127.0.0.1:{server.server_port}"
            with urlopen(address + "/", timeout=3) as response:
                page = response.read().decode("utf-8")
                self.assertEqual(response.status, 200)
                self.assertIn('id="national-map"', page)
                self.assertIn('id="back-to-australia"', page)
                self.assertNotIn('id="vector-map"', page)
                self.assertNotIn("Melbourne dashboard", page)
            with urlopen(address + "/static/index.html", timeout=3) as response:
                old_page = response.read().decode("utf-8")
                self.assertIn('url=/static/national.html', old_page)
        finally:
            server.shutdown()
            thread.join(timeout=3)
            server.server_close()


if __name__ == "__main__":
    unittest.main()
