"""Offline tests for bounded national batches. No API requests are made."""
import io
import json
import tempfile
import unittest
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import parse_qs, urlparse

import national_batch as batch


class Response:
    def __init__(self, data):
        self.data = data

    def __enter__(self):
        return io.BytesIO(json.dumps(self.data).encode())

    def __exit__(self, *_args):
        return False


class BoundedBatchTests(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name)
        self.out = self.root / "data"
        self.catalogue = self.root / "locations.json"
        self.places = [{
            "id": f"place-{i}", "name": f"Place {i}", "state": "VIC",
            "region": "Metro", "latitude": -38 + i * .1,
            "longitude": 144 + i * .1, "groups": ["australia_historical"],
        } for i in range(5)]
        self.catalogue.write_text(json.dumps({"locations": self.places}))
        days = (batch.hist.END - batch.hist.START).days + 1
        self.dates = [(batch.hist.START + batch.hist.timedelta(days=i)).isoformat()
                      for i in range(days)]
        self.calls = []

    def payload(self):
        return {
            "timezone": "Australia/Melbourne",
            "daily_units": dict(zip(batch.hist.FIELDS, batch.hist.UNITS)),
            "daily": {"time": self.dates,
                      "temperature_2m_mean": [20] * len(self.dates),
                      "temperature_2m_min": [15] * len(self.dates),
                      "temperature_2m_max": [25] * len(self.dates),
                      "precipitation_sum": [1] * len(self.dates)},
        }

    def good(self, url, timeout=0):
        count = len(parse_qs(urlparse(url).query)["latitude"][0].split(","))
        self.calls.append(count)
        return Response([self.payload() for _ in range(count)]
                        if count > 1 else self.payload())

    def test_splits_five_locations_into_two_two_one(self):
        pauses = []
        result = batch.process(self.catalogue, self.out, self.good,
                               batch_size=2, delay=1, sleep=pauses.append)
        self.assertEqual(self.calls, [2, 2, 1])
        self.assertEqual(pauses, [1, 1])
        self.assertEqual(result["completed"], 5)
        self.assertEqual(result["missing"], [])
        self.assertEqual(result["attempted_batches"], 3)
        self.assertEqual(json.loads((self.out / "batch_result.json").read_text()), result)

        batch.process(self.catalogue, self.out, self.good, delay=0)
        self.assertEqual(self.calls, [2, 2, 1])  # all files were cached

    def test_rate_limit_stops_and_later_run_resumes(self):
        def limited(url, timeout=0):
            if len(self.calls) == 1:
                self.calls.append(-1)
                raise HTTPError(url, 429, "Too Many Requests", {}, None)
            return self.good(url, timeout)

        first = batch.process(self.catalogue, self.out, limited,
                              batch_size=2, delay=0)
        self.assertEqual(self.calls, [2, -1])
        self.assertTrue(first["stopped"])
        self.assertIn("429", first["reason"])
        self.assertEqual(first["completed"], 2)
        self.assertEqual(len(first["missing"]), 3)
        self.assertTrue((self.out / "locations" / "place-0.json").exists())

        self.calls.clear()
        second = batch.process(self.catalogue, self.out, self.good,
                               batch_size=2, delay=0)
        self.assertEqual(self.calls, [2, 1])
        self.assertEqual(second["completed"], 5)
        self.assertEqual(second["missing"], [])

    def test_bad_request_stops_without_wiping_cache(self):
        def bad(url, timeout=0):
            self.calls.append(1)
            raise HTTPError(url, 400, "Request too large", {}, None)
        result = batch.process(self.catalogue, self.out, bad, delay=0)
        self.assertEqual(self.calls, [1])
        self.assertEqual(len(result["missing"]), 5)
        self.assertTrue(result["stopped"])
        self.assertIn("400", result["reason"])
        self.assertTrue((self.out / "batch_result.json").exists())

    def test_wrong_shape_and_network_errors_leave_files_missing(self):
        attempts = []
        def wrong(url, timeout=0):
            attempts.append(url)
            return Response({})
        result = batch.process(self.catalogue, self.out, wrong,
                               batch_size=2, delay=0)
        self.assertEqual(len(attempts), 3)
        self.assertEqual(result["completed"], 0)
        self.assertEqual(len(result["failed"]), 5)
        self.assertEqual(len(result["missing"]), 5)

    def test_invalid_settings(self):
        for value in (0, 6):
            with self.assertRaises(ValueError):
                batch.process(self.catalogue, self.out, batch_size=value)
        with self.assertRaises(ValueError):
            batch.process(self.catalogue, self.out, delay=-1)


if __name__ == "__main__":
    unittest.main()
