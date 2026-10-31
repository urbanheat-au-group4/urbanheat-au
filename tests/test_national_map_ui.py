"""Check national map navigation and behaviour."""
import shutil
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class NationalMapUITests(unittest.TestCase):
    def test_melbourne_homepage_links_to_national_map(self):
        homepage = (ROOT / "static/index.html").read_text()
        self.assertIn('href="/static/national.html"', homepage)

    def test_national_page_loads_helpers_before_map(self):
        html = (ROOT / "static/national.html").read_text()
        self.assertLess(html.index('/static/national_annotations.js'),
                        html.index('/static/national.js'))
        for element_id in ('back-to-australia', 'heat-annotations', 'national-map',
                           'map-title', 'state-summary'):
            self.assertIn('id="' + element_id + '"', html)

    def test_eight_jurisdictions_have_fourteen_locations_each(self):
        import json
        places = json.loads((ROOT / "locations.json").read_text())["locations"]
        for code in ('NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'):
            self.assertEqual(sum(p["state"] == code for p in places), 14)

    @unittest.skipUnless(shutil.which("node"), "Node is needed for browser JS checks")
    def test_javascript_and_annotation_layout(self):
        for path in ('national.js', 'national_annotations.js'):
            result = subprocess.run(["node", "--check", str(ROOT / "static" / path)],
                                    capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
        result = subprocess.run(["node", str(ROOT / "tests/check_national_annotations.js")],
                                capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == '__main__':
    unittest.main()
