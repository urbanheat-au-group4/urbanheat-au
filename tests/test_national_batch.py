"""Offline tests for one-call historical downloads."""
import io
import json
import tempfile
import unittest
from pathlib import Path

import national_batch as batch


class Response:
    def __init__(self, data):
        self.data = data
    def __enter__(self):
        return io.BytesIO(json.dumps(self.data).encode())
    def __exit__(self, *_args):
        return False


class BatchTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.out = Path(self.tmp.name) / "data"
        self.catalogue = Path(self.tmp.name) / "locations.json"
        places = [
            {"id": "melbourne", "name": "Melbourne", "state": "VIC",
             "region": "Metro", "latitude": -37.8, "longitude": 144.9,
             "groups": ["australia_historical"]},
            {"id": "perth", "name": "Perth", "state": "WA",
             "region": "Metro", "latitude": -31.9, "longitude": 115.8,
             "groups": ["australia_historical"]}]
        self.catalogue.write_text(json.dumps({"locations": places}))
        self.places = places

    def test_batch_url_contains_both_locations(self):
        url = batch.build_url(self.places)
        self.assertIn("-37.8%2C-31.9", url)
        self.assertIn("Australia%2FMelbourne%2CAustralia%2FPerth", url)

    def test_one_call_saves_two_files_and_next_run_uses_cache(self):
        days = (batch.hist.END - batch.hist.START).days + 1
        times = [(batch.hist.START + batch.hist.timedelta(days=i)).isoformat()
                 for i in range(days)]
        def payload(zone):
            return {"timezone": zone,
                    "daily_units": dict(zip(batch.hist.FIELDS, batch.hist.UNITS)),
                    "daily": {"time": times,
                              "temperature_2m_mean": [20] * days,
                              "temperature_2m_min": [15] * days,
                              "temperature_2m_max": [25] * days,
                              "precipitation_sum": [1] * days}}
        calls = []
        def opener(url, timeout=0):
            calls.append(url)
            return Response([payload("Australia/Melbourne"), payload("Australia/Perth")])
        result = batch.process(self.catalogue, self.out, opener)
        self.assertEqual(result["completed"], 2)
        self.assertEqual(len(calls), 1)
        result = batch.process(self.catalogue, self.out, opener)
        self.assertEqual(result["completed"], 2)
        self.assertEqual(len(calls), 1)

    def test_bad_batch_shape_saves_nothing(self):
        result = batch.process(self.catalogue, self.out, lambda *_a, **_kw: Response({}))
        self.assertEqual(result["completed"], 0)
        self.assertFalse((self.out / "locations" / "melbourne.json").exists())


if __name__ == "__main__":
    unittest.main()
