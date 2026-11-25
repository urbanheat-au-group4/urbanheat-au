import json
import re
import shutil
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import build_site
from fetch_national_boundaries import STATES


class BuildSiteTests(unittest.TestCase):
    def test_dashboard_references_resolve_in_the_pages_package(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            static = root / "static"
            shutil.copytree(build_site.ROOT / "static", static)
            (static / "national_data.json").write_text("{}")
            (static / "australia_states.geojson").write_text(json.dumps({
                "type": "FeatureCollection",
                "features": [
                    {"properties": {"shapeName": state}, "geometry": {"type": "Polygon"}}
                    for state in sorted(STATES)
                ],
            }))

            site = root / "_site"
            with patch.object(build_site, "ROOT", root), patch.object(build_site, "OUT", site):
                build_site.build()

            html = (site / "index.html").read_text()
            self.assertNotIn('"/static/', html)
            for asset in re.findall(r'(?:src|href)="(\./static/[^\"]+)"', html):
                self.assertTrue((site / asset).is_file(), asset)

            css = (site / "static/national.css").read_text()
            background = re.search(r'url\("([^\"]+BG\.jpg)"\)', css).group(1)
            self.assertTrue((site / "static" / background).is_file(), background)
            loader = (site / "static/dashboard_data.js").read_text()
            for filename in ("national_data.json", "national_history.json", "national_seasons.json"):
                self.assertIn("./static/" + filename, loader)
