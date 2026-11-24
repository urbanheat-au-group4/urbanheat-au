import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import historical_weather as hist
import pages_climate


class PagesClimateTests(unittest.TestCase):
    def test_partial_bundle_keeps_catalogue_and_matches_chart_coverage(self):
        metadata = {
            "source": "Open-Meteo Historical Weather API",
            "model": hist.MODEL,
            "start_date": hist.START.isoformat(),
            "end_date": hist.END.isoformat(),
            "skipped": ["missing"],
        }
        mapped = {
            **metadata, "count": 2,
            "locations": [{"id": "covered", "annual_mean_c": 19}, {"id": "missing"}],
        }
        chart = {**metadata, "locations": [{"id": "covered"}]}
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            (output / "national_data.json").write_text(json.dumps(mapped))
            (output / "national_history.json").write_text(json.dumps(chart))
            seasons = output / "national_seasons.json"
            seasons.write_text(json.dumps(chart))
            with patch.object(pages_climate, "markers", return_value=mapped["locations"]):
                self.assertEqual(pages_climate.check(output), (1, 2))
                seasons.write_text(json.dumps({**chart, "locations": [{"id": "missing"}]}))
                with self.assertRaisesRegex(ValueError, "disagree about which locations"):
                    pages_climate.check(output)
