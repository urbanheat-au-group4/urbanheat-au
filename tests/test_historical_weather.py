"""Offline tests for the historical weather importer."""
import json
import tempfile
import unittest
from datetime import timedelta
from pathlib import Path
from unittest.mock import patch

import historical_weather as hist


def location():
    return {"id": "melbourne-cbd", "name": "Melbourne CBD",
            "latitude": -37.8136, "longitude": 144.9631}


def response():
    n = (hist.END - hist.START).days + 1
    dates = [(hist.START + timedelta(days=i)).isoformat() for i in range(n)]
    return {
        "timezone": "Australia/Melbourne",
        "daily_units": dict(zip(hist.FIELDS, hist.UNITS)),
        "daily": {"time": dates,
                  "temperature_2m_mean": [20.0] * n,
                  "temperature_2m_max": [25.0] * n,
                  "temperature_2m_min": [15.0] * n,
                  "precipitation_sum": [1.2] * n},
    }


class HistoricalTests(unittest.TestCase):
    def test_full_date_range(self):
        result = hist.validate(response(), location())
        self.assertEqual(len(result["days"]), (hist.END - hist.START).days + 1)
        self.assertEqual(result["missing_values"], 0)

    def test_missing_values_are_marked(self):
        data = response()
        data["daily"]["temperature_2m_mean"][0] = None
        result = hist.validate(data, location())
        self.assertIsNone(result["days"][0]["temperature_2m_mean"])
        self.assertEqual(result["missing_values"], 1)

    def test_malformed_and_wrong_units(self):
        for key, value in (("timezone", "UTC"), ("daily_units", {}),
                           ("daily", {})):
            with self.subTest(key=key):
                data = response()
                data[key] = value
                with self.assertRaises(ValueError):
                    hist.validate(data, location())

    def test_missing_date_detected(self):
        data = response()
        data["daily"]["time"][2] = data["daily"]["time"][1]
        with self.assertRaises(ValueError):
            hist.validate(data, location())

    def test_missing_series_detected(self):
        data = response()
        data["daily"]["temperature_2m_max"].pop()
        with self.assertRaises(ValueError):
            hist.validate(data, location())

    def test_invalid_numeric_values(self):
        for value in (float("nan"), float("inf"), "30", True):
            with self.subTest(value=str(value)):
                data = response()
                data["daily"]["temperature_2m_max"][0] = value
                with self.assertRaises(ValueError):
                    hist.validate(data, location())

    def test_inconsistent_temperatures(self):
        data = response()
        data["daily"]["temperature_2m_min"][0] = 99
        with self.assertRaises(ValueError):
            hist.validate(data, location())

    def test_negative_rainfall(self):
        data = response()
        data["daily"]["precipitation_sum"][0] = -1
        with self.assertRaises(ValueError):
            hist.validate(data, location())

    def test_preserve_file_on_failure(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "history.json"
            output.write_text("old valid data")
            with patch.object(hist, "OUTPUT", output), patch.object(hist, "locations", return_value=[location()]), patch.object(hist, "fetch_one", side_effect=RuntimeError("network down")):
                self.assertEqual(hist.main(), 1)
            self.assertEqual(output.read_text(), "old valid data")

    def test_catalogue_rejects_duplicate_ids(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "locations.json"
            path.write_text(json.dumps([location(), location()]))
            with patch.object(hist, "CATALOGUE", path):
                with self.assertRaises(ValueError):
                    hist.locations()

    def test_catalogue_rejects_invalid_coordinates(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "locations.json"
            entry = location()
            entry["latitude"] = 200
            path.write_text(json.dumps([entry]))
            with patch.object(hist, "CATALOGUE", path):
                with self.assertRaises(ValueError):
                    hist.locations()


if __name__ == "__main__":
    unittest.main()
