"""Offline tests for resumable national historical ingestion."""
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import national_ingest as ni


class NationalIngestTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        root = Path(self.temp.name)
        self.catalogue = root / "catalogue.json"
        self.out = root / "national"
        self.place = {"id": "melbourne-cbd", "name": "Melbourne CBD",
                      "state": "VIC", "region": "Metro", "groups": ["australia_historical"],
                      "latitude": -37.8136, "longitude": 144.9631}
        self.catalogue.write_text(json.dumps({"locations": [self.place]}), encoding="utf-8")

    def test_successful_run_is_cached_and_repeatable(self):
        days = (ni.hist.END - ni.hist.START).days + 1
        valid = {"id": self.place["id"], "latitude": self.place["latitude"],
                 "longitude": self.place["longitude"], "missing_values": 0,
                 "days": [
                     {"date": (ni.hist.START + ni.hist.timedelta(days=i)).isoformat(),
                      "temperature_2m_mean": 20, "temperature_2m_max": 25,
                      "temperature_2m_min": 15, "precipitation_sum": 0}
                     for i in range(days)]}
        with patch.object(ni.hist, "validate", return_value=valid) as validator:
            manifest = ni.process(self.catalogue, self.out, fetch=lambda _: {"ok": True})
            self.assertEqual(manifest["completed"], 1)
            self.assertEqual(manifest["locations"][0]["status"], "updated")
            manifest = ni.process(self.catalogue, self.out, fetch=lambda _: self.fail("must not fetch cached"))
            self.assertEqual(manifest["locations"][0]["status"], "cached")
            validator.assert_called_once()

    def test_national_timezones_and_cache_signature(self):
        zones = {"VIC": "Australia/Melbourne", "NSW": "Australia/Sydney",
                 "ACT": "Australia/Sydney", "QLD": "Australia/Brisbane",
                 "WA": "Australia/Perth", "SA": "Australia/Adelaide",
                 "TAS": "Australia/Hobart", "NT": "Australia/Darwin"}
        for state, tz in zones.items():
            with self.subTest(state=state):
                place = {**self.place, "state": state}
                self.assertEqual(ni.location_timezone(place), tz)
                if state != "VIC":
                    self.assertNotEqual(ni.signature(place), ni.signature(self.place))

    def test_bad_internal_date_is_not_cached(self):
        count = (ni.hist.END - ni.hist.START).days + 1
        rows = [{"date": (ni.hist.START + ni.hist.timedelta(days=i)).isoformat(),
                 "temperature_2m_mean": 20, "temperature_2m_min": 15,
                 "temperature_2m_max": 25, "precipitation_sum": 1}
                for i in range(count)]
        rows[3]["date"] = rows[2]["date"]
        path = self.out / "locations" / "melbourne-cbd.json"
        path.parent.mkdir(parents=True)
        path.write_text(json.dumps({
            "signature": ni.signature(self.place), "model": ni.hist.MODEL,
            "timezone": "Australia/Melbourne",
            "start_date": ni.hist.START.isoformat(),
            "end_date": ni.hist.END.isoformat(),
            "units": dict(zip(ni.hist.FIELDS, ni.hist.UNITS)),
            "data": {"id": self.place["id"], "latitude": self.place["latitude"],
                     "longitude": self.place["longitude"],
                     "missing_values": 0, "days": rows},
        }))
        self.assertFalse(ni.valid_cached(path, self.place))

    def test_failed_location_preserves_existing_snapshot(self):
        target = self.out / "locations" / "melbourne-cbd.json"
        target.parent.mkdir(parents=True)
        target.write_text("old valid data", encoding="utf-8")
        manifest = ni.process(self.catalogue, self.out,
                              fetch=lambda _: (_ for _ in ()).throw(RuntimeError("network down")))
        self.assertEqual(manifest["completed"], 0)
        self.assertEqual(target.read_text(encoding="utf-8"), "old valid data")
        self.assertEqual(manifest["locations"][0]["status"], "failed")

    def test_changed_coordinates_invalidate_cache(self):
        target = self.out / "locations" / "melbourne-cbd.json"
        target.parent.mkdir(parents=True)
        target.write_text(json.dumps({"signature": ni.signature(self.place),
                                      "data": {"id": "melbourne-cbd", "days": []}}))
        self.assertFalse(ni.valid_cached(target, self.place))

    def test_rejects_invalid_catalogue(self):
        self.catalogue.write_text(json.dumps({"locations": [{**self.place, "latitude": 999}]}))
        with self.assertRaises(ValueError):
            ni.process(self.catalogue, self.out, fetch=lambda _: {})


if __name__ == "__main__":
    unittest.main()
