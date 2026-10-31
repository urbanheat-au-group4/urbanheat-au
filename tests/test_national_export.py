"""Tests for the national map export."""
import unittest
from unittest.mock import patch
from pathlib import Path
import tempfile
import json
import national_export

class NationalExportTests(unittest.TestCase):
    def test_export_joins_climate_with_map_points(self):
        climate = {"source": "test", "start_date": "2015-01-01", "end_date": "2025-12-31",
                   "skipped_locations": [], "locations": [
                       {"id": "melbourne", "name": "Melbourne", "state": "VIC",
                        "annual_mean_c": 18, "annual_average_max_c": 23,
                        "annual_average_min_c": 13, "average_annual_rainfall_mm": 600,
                        "average_days_at_least_35c": 8}]}
        points = [{"id": "melbourne", "x": 700, "y": 550,\n                   "latitude": -37.8, "longitude": 144.9}]
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder) / "national.json"
            with patch.object(national_export, "build", return_value=climate), \
                 patch.object(national_export, "markers", return_value=points):
                result = national_export.export(Path("ignored"), Path("ignored"), target)
            self.assertEqual(result["count"], 1)
            item = json.loads(target.read_text())["locations"][0]
            self.assertEqual((item["x"], item["y"]), (700, 550))
            self.assertEqual(item["annual_mean_c"], 18)\n            self.assertEqual(item["latitude"], -37.8)\n            self.assertEqual(result["state_counts"]["VIC"], 1)

if __name__ == "__main__":
    unittest.main()
