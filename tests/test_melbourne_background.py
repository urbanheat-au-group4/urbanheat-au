"""Check the Melbourne map doesn't hide suburbs from its saved background."""
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

class MelbourneBackgroundTests(unittest.TestCase):
    def test_background_is_not_filtered(self):
        script = (ROOT / "static/app.js").read_text()
        self.assertIn("background = await getGeoJSON('/static/metro_context.geojson')", script)
        self.assertNotIn("withinMelbourneContext", script)

    def test_saved_background_has_west_and_south_suburbs(self):
        data = json.loads((ROOT / "static/metro_context.geojson").read_text())
        self.assertGreater(len(data["features"]), 200)
        coordinates = []
        for feature in data["features"]:
            geometry = feature["geometry"]
            polygons = [geometry["coordinates"]] if geometry["type"] == "Polygon" else geometry["coordinates"]
            for polygon in polygons:
                for ring in polygon:
                    coordinates.extend(ring)
        self.assertTrue(any(lon < 144.9 and lat < -38 for lon, lat in coordinates))

if __name__ == "__main__":
    unittest.main()
