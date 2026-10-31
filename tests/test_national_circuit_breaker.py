"""Verify national ingest stops after provider throttling and limits each run."""
import json
import tempfile
import unittest
from pathlib import Path

import national_ingest as ni


class CircuitBreakerTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.path = Path(self.tmp.name) / "catalogue.json"
        self.out = Path(self.tmp.name) / "data"
        places = [{"id": f"place-{i}", "name": f"Place {i}",
                   "state": "VIC", "region": "Test",
                   "latitude": -37 + i / 100,
                   "longitude": 145.0,
                   "groups": ["australia_historical"]} for i in range(3)]
        self.path.write_text(json.dumps({"locations": places}))

    def test_first_throttle_defers_other_requests(self):
        requests = []
        def blocked(place):
            requests.append(place["id"])
            raise RuntimeError("HTTP Error 429: Too Many Requests")
        result = ni.process(self.path, self.out, fetch=blocked,
                            delay=0, max_new=5)
        self.assertEqual(requests, ["place-0"])
        self.assertTrue(result["throttled"])
        self.assertEqual(result["attempted"], 1)
        self.assertEqual([r["status"] for r in result["locations"]],
                         ["failed", "deferred", "deferred"])

    def test_batch_cap_limits_uncached_requests(self):
        requests = []
        def unavailable(place):
            requests.append(place["id"])
            raise RuntimeError("temporary timeout")
        result = ni.process(self.path, self.out, fetch=unavailable,
                            delay=0, max_new=2)
        self.assertEqual(len(requests), 2)
        self.assertEqual([r["status"] for r in result["locations"]],
                         ["failed", "failed", "deferred"])


if __name__ == "__main__":
    unittest.main()
