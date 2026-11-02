"""Checks for the Greater Melbourne background download."""
import unittest
from pathlib import Path

import fetch_metro_context as metro


def square(west, south, east, north):
    return {"geometry": {"type": "Polygon", "coordinates": [[
        [west, south], [east, south], [east, north], [west, north], [west, south]
    ]]}}


class MetroContextTests(unittest.TestCase):
    def test_fetch_area_covers_wider_melbourne(self):
        west, south, east, north = metro.BBOX
        self.assertLess(west, 144.6)
        self.assertLess(south, -38.2)
        self.assertGreater(east, 145.5)
        self.assertGreater(north, -37.5)

    def test_rejects_the_old_partial_background(self):
        old = [square(144.70, -38.08, 145.36, -37.60)]
        with self.assertRaisesRegex(ValueError, "Incomplete"):
            metro.check_coverage(old)

    def test_accepts_full_background(self):
        full = [square(144.35, -38.48, 145.85, -37.35)]
        self.assertEqual(metro.check_coverage(full),
                         (144.35, -38.48, 145.85, -37.35))

    def test_browser_fits_to_monitored_locations_not_distant_background(self):
        javascript = (Path(__file__).resolve().parents[1] / "static" / "app.js").read_text()
        self.assertIn("fitMapBounds(monitored)", javascript)
        self.assertNotIn("fitMapBounds([...background, ...monitored])", javascript)
        self.assertNotIn("withinMelbourneContext", javascript)


if __name__ == "__main__":
    unittest.main()
