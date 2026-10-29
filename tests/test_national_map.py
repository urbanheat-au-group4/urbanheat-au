"""Offline tests for national-map marker geometry."""
import unittest
from pathlib import Path

from national_map import markers, marker_svg, project, jurisdiction_counts


CATALOGUE = Path(__file__).resolve().parents[1] / "locations.json"


class NationalMapTests(unittest.TestCase):
    def test_projection_is_within_viewbox(self):
        for lat, lon in ((-37.8136, 144.9631), (-12.4634, 130.8456), (-42.8821, 147.3272)):
            x, y = project(lat, lon)
            self.assertTrue(0 <= x <= 1000)
            self.assertTrue(0 <= y <= 760)

    def test_outside_extent_rejected(self):
        with self.assertRaises(ValueError):
            project(40, 100)

    def test_all_states_have_fourteen_markers(self):
        locations = markers(CATALOGUE)
        self.assertEqual(len(locations), 112)
        self.assertEqual(set(jurisdiction_counts(locations).values()), {14})
        self.assertEqual(len({r["id"] for r in locations}), 112)

    def test_state_filter(self):
        self.assertEqual(len(markers(CATALOGUE, "VIC")), 14)
        with self.assertRaises(ValueError):
            markers(CATALOGUE, "XX")

    def test_svg_escapes_label_and_id(self):
        svg = marker_svg([{"id": 'test" onload="alert(1)', "name": "<evil>",
                           "state": "VIC", "x": 10, "y": 20}])
        self.assertIn("&lt;evil&gt;", svg)
        self.assertNotIn('data-location-id="test" onload=', svg)


if __name__ == "__main__":
    unittest.main()
