"""Regression checks for the six Melbourne map polygons bundled with the UI."""

import json
import math
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATASET = ROOT / "static" / "suburb_boundaries.geojson"
EXPECTED_NAMES = {
    "MELBOURNE", "MELTON", "WERRIBEE",
    "CRAIGIEBURN", "BELGRAVE", "FRANKSTON",
}


class TestBundledBoundaryDataset(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = json.loads(DATASET.read_text(encoding="utf-8"))

    def test_six_expected_localities(self):
        self.assertEqual(self.data["type"], "FeatureCollection")
        features = self.data["features"]
        self.assertEqual(len(features), len(EXPECTED_NAMES))
        names = [f["properties"]["locality_name"].upper() for f in features]
        self.assertEqual(set(names), EXPECTED_NAMES)
        self.assertEqual(len(names), len(set(names)))

    def test_polygon_geometry_is_valid_and_within_melbourne(self):
        for feature in self.data["features"]:
            with self.subTest(locality=feature["properties"]["locality_name"]):
                geometry = feature["geometry"]
                self.assertIn(geometry["type"], ("Polygon", "MultiPolygon"))
                polygons = (
                    [geometry["coordinates"]]
                    if geometry["type"] == "Polygon"
                    else geometry["coordinates"]
                )
                self.assertTrue(polygons)
                for polygon in polygons:
                    self.assertTrue(polygon)
                    for ring in polygon:
                        self.assertGreaterEqual(len(ring), 4)
                        self.assertEqual(ring[0], ring[-1])
                        for lon, lat in ring:
                            self.assertTrue(math.isfinite(lon) and math.isfinite(lat))
                            self.assertGreaterEqual(lon, 144.4)
                            self.assertLessEqual(lon, 145.6)
                            self.assertGreaterEqual(lat, -38.4)
                            self.assertLessEqual(lat, -37.3)


if __name__ == "__main__":
    unittest.main()
