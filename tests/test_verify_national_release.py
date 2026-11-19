"""Test the final release audit without network calls or real weather fixtures."""
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import verify_national_release as verify


class ReleaseAuditTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.static = self.root / "static"
        self.static.mkdir()
        self.places = [
            {"id": "a", "name": "A", "state": "VIC"},
            {"id": "b", "name": "B", "state": "NSW"},
        ]

    def write(self, name, rows, **extra):
        data = {
            "locations": rows, "model": verify.hist.MODEL,
            "start_date": verify.hist.START.isoformat(),
            "end_date": verify.hist.END.isoformat(),
            **extra,
        }
        (self.static / verify.EXPORTS[name]).write_text(json.dumps(data))

    def fixtures(self):
        self.write("map", [
            {"id": p["id"], "monthly_average_max_c": [20] * 12}
            for p in self.places], count=2)
        self.write("history", [
            {"id": p["id"], "years": [{"year": y} for y in range(2015, 2026)]}
            for p in self.places])
        self.write("seasons", [
            {"id": p["id"], "seasons": [{}, {}, {}, {}]}
            for p in self.places])

    def run_audit(self, complete=2):
        with patch.object(verify, "load_catalogue", return_value=self.places), \
             patch.object(verify.national_coverage, "build_report",
                          return_value={"complete_locations": complete,
                                        "expected_locations": 2}):
            return verify.audit(self.root / "locations.json", self.root, self.static)

    def test_all_exports_and_coverage_pass(self):
        self.fixtures()
        self.assertTrue(self.run_audit()["pass"])

    def test_missing_data_fails(self):
        self.fixtures()
        result = self.run_audit(complete=1)
        self.assertFalse(result["pass"])
        self.assertIn("snapshots", result["problems"][0])

    def test_missing_and_stale_exports_fail(self):
        self.fixtures()
        (self.static / "national_history.json").unlink()
        self.assertFalse(self.run_audit()["pass"])
        self.fixtures()
        self.write("history", [{"id": "a", "years": []}])
        self.assertFalse(self.run_audit()["pass"])

    def test_wrong_model_duplicate_ids_and_months_fail(self):
        self.fixtures()
        self.write("map", [{"id": "a", "monthly_average_max_c": [20]}] * 2,
                   count=2, model="wrong")
        result = self.run_audit()
        self.assertFalse(result["pass"])
        self.assertGreaterEqual(len(result["problems"]), 2)


if __name__ == "__main__":
    unittest.main()
