"""Offline national coverage tests with complete and damaged fixture data."""
import json
import tempfile
import unittest
from datetime import timedelta
from pathlib import Path

import historical_weather as hist
import national_coverage as cov


def complete_days():
    count = (hist.END - hist.START).days + 1
    return [
        {"date": (hist.START + timedelta(days=n)).isoformat(),
         "temperature_2m_mean": 20, "temperature_2m_min": 15,
         "temperature_2m_max": 25, "precipitation_sum": 0.0}
        for n in range(count)
    ]


class CoverageTests(unittest.TestCase):
    def test_complete_and_leap_year(self):
        days = complete_days()
        result = cov.evaluate_year(days, 2016)
        self.assertEqual(result["expected_days"], 366)
        self.assertEqual(result["retrieved_unique_days"], 366)
        self.assertEqual(result["status"], "complete")

    def test_missing_duplicate_and_null_fields(self):
        days = complete_days()
        days[0]["temperature_2m_mean"] = None
        days.append(dict(days[1]))
        days.pop(2)
        result = cov.evaluate_year(days, 2015)
        self.assertEqual(result["missing_days"], 1)
        self.assertEqual(result["duplicate_days"], 1)
        self.assertEqual(result["missing_values"]["temperature_2m_mean"], 1)
        self.assertEqual(result["status"], "incomplete")

    def test_reject_invalid_numeric_type(self):
        days = complete_days()
        days[0]["temperature_2m_mean"] = float("nan")
        days[1]["precipitation_sum"] = -1.0
        y = cov.evaluate_year(days, 2015)
        self.assertEqual(y["invalid_values"]["temperature_2m_mean"], 1)
        self.assertEqual(y["invalid_values"]["precipitation_sum"], 1)
        self.assertEqual(y["status"], "incomplete")

    def test_missing_location_and_metadata_mismatch(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            place = {"id": "test", "name": "Test", "state": "VIC",
                     "latitude": -37.8, "longitude": 145.0}
            result = cov.assess_location(place, root)
            self.assertEqual(result["errors"], ["snapshot_missing"])
            self.assertEqual(result["status"], "incomplete")
            path = root / "locations" / "test.json"
            path.parent.mkdir()
            path.write_text(json.dumps({
                "model": "wrong", "timezone": "Australia/Melbourne",
                "start_date": hist.START.isoformat(), "end_date": hist.END.isoformat(),
                "units": dict(zip(hist.FIELDS, hist.UNITS)),
                "data": {"id": "test", "days": complete_days()},
            }))
            result = cov.assess_location(place, root)
            self.assertIn("model_mismatch", result["errors"])
            self.assertEqual(result["status"], "incomplete")


if __name__ == "__main__":
    unittest.main()
