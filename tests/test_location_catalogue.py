"""Catalogue tests avoid network calls and preserve existing dashboard scope."""
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import historical_weather
from location_catalogue import load_catalogue, validate_catalogue


def row(name="Melbourne CBD", state="VIC", key="melbourne-cbd"):
    return {"id": key, "name": name, "latitude": -37.8136,
            "longitude": 144.9631, "state": state,
            "region": "Greater Melbourne", "groups": ["melbourne_dashboard"]}


class CatalogueTests(unittest.TestCase):
    def test_repository_catalogue_counts_and_grouping(self):
        path = Path(__file__).resolve().parents[1] / "locations.json"
        all_records = load_catalogue(path)
        self.assertEqual(len(all_records), 21)
        self.assertEqual({r["state"] for r in all_records},
                         {"VIC", "NSW", "QLD", "WA", "SA", "TAS", "ACT", "NT"})
        dashboard = load_catalogue(path, "melbourne_dashboard")
        self.assertEqual(len(dashboard), 6)
        self.assertEqual({r["name"] for r in dashboard},
                         set(historical_weather.weather.SUBURBS))
        self.assertEqual(len(load_catalogue(path, "australia_historical")), 21)

    def test_historical_importer_remains_six_by_default(self):
        with patch.dict("os.environ", {}, clear=True):
            self.assertEqual(len(historical_weather.locations()), 6)
        self.assertEqual(len(historical_weather.locations("australia_historical")), 21)

    def test_invalid_record_rejected(self):
        for field, invalid in (
            ("id", "Invalid ID"), ("state", "XX"), ("region", ""),
            ("latitude", 200), ("longitude", float("nan")),
            ("groups", []), ("groups", ["a", "a"]),
        ):
            with self.subTest(field=field):
                sample = row()
                sample[field] = invalid
                with self.assertRaises(ValueError):
                    validate_catalogue([sample])

    def test_duplicate_ids_and_names_rejected(self):
        with self.assertRaises(ValueError):
            validate_catalogue([row(), row()])
        with self.assertRaises(ValueError):
            validate_catalogue([row(), row(key="second")])

    def test_missing_groups_and_unknown_selection(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "locations.json"
            path.write_text(json.dumps({"locations": [row()]}))
            with self.assertRaisesRegex(ValueError, "No locations found"):
                load_catalogue(path, "national_map")
            entry = row()
            del entry["groups"]
            path.write_text(json.dumps({"locations": [entry]}))
            with self.assertRaises(ValueError):
                load_catalogue(path)


if __name__ == "__main__":
    unittest.main()
