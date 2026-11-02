"""Guard against overlapping labels on the six-location Melbourne map.

This test uses only the committed polygons and the dashboard's fixed offsets.
It does not fetch weather or rely on external map services.
"""

import json
import math
import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
COS_LAT = math.cos(math.radians(37.9))
WIDTH, HEIGHT = 1000, 580


def point_rings(geometry):
    if geometry["type"] == "Polygon":
        polygons = [geometry["coordinates"]]
    else:
        polygons = geometry["coordinates"]
    return [ring for polygon in polygons for ring in polygon]


def label_offsets():
    code = (ROOT / "static" / "app.js").read_text(encoding="utf-8")
    match = re.search(r"const labelOffsets\\s*=\\s*\\{(.*?)\\};", code, re.S)
    assert match, "Dashboard label positions missing"
    offsets = {}
    for label, bare, dx, dy in re.findall(
        r"(?:'([^']+)'|([A-Za-z]+))\\s*:\\s*\\[(-?\\d+),\\s*(-?\\d+)\\]",
        match.group(1),
    ):
        offsets[label or bare] = (int(dx), int(dy))
    return offsets


class TestMapLabelSpacing(unittest.TestCase):
    def test_visible_labels_have_non_overlapping_boxes(self):
        features = json.loads(
            (ROOT / "static" / "suburb_boundaries.geojson").read_text(encoding="utf-8")
        )["features"]
        names = {
            "MELBOURNE": "Melbourne CBD", "MELTON": "Melton",
            "WERRIBEE": "Werribee", "CRAIGIEBURN": "Craigieburn",
            "BELGRAVE": "Belgrave", "FRANKSTON": "Frankston",
        }
        offsets = label_offsets()
        self.assertEqual(set(offsets), set(names.values()))
        points = [
            (lon * COS_LAT, -lat)
            for feature in features
            for ring in point_rings(feature["geometry"])
            for lon, lat in ring
        ]
        west = min(x for x, _ in points)
        east = max(x for x, _ in points)
        north = min(y for _, y in points)
        south = max(y for _, y in points)
        x_margin = max((east - west) * 0.06, 0.01)
        y_margin = max((south - north) * 0.06, 0.01)
        west -= x_margin
        east += x_margin
        north -= y_margin
        south += y_margin
        scale = min(900 / (east - west), 480 / (south - north))
        x_pad = (WIDTH - (east - west) * scale) / 2
        y_pad = (HEIGHT - (south - north) * scale) / 2

        boxes = []
        for feature in features:
            label = names[feature["properties"]["locality_name"].upper()]
            pixel_points = [
                (x_pad + (lon * COS_LAT - west) * scale,
                 y_pad + (-lat - north) * scale)
                for ring in point_rings(feature["geometry"])
                for lon, lat in ring
            ]
            center_x = (min(p[0] for p in pixel_points) + max(p[0] for p in pixel_points)) / 2
            center_y = (min(p[1] for p in pixel_points) + max(p[1] for p in pixel_points)) / 2
            dx, dy = offsets[label]
            x = max(90, min(910, center_x + dx))
            y = max(42, min(535, center_y + dy))
            half_width = max(len(label) * 5.3, 34)
            box = (x - half_width, y - 22, x + half_width, y + 17)
            for other, existing in boxes:
                overlaps = not (
                    box[2] + 8 < existing[0] or existing[2] + 8 < box[0]
                    or box[3] + 8 < existing[1] or existing[3] + 8 < box[1]
                )
                self.assertFalse(overlaps, f"Labels overlap: {label} and {other}")
            boxes.append((label, box))


if __name__ == "__main__":
    unittest.main()
