"""Basic tests for the national comparison."""
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import national_climate


class NationalClimateTests(unittest.TestCase):
    def test_skips_incomplete_locations(self):
        places = [{"id": "a", "name": "A", "state": "VIC"},
                  {"id": "b", "name": "B", "state": "NSW"}]
        coverage = {"locations": [{"id": "a", "status": "incomplete"},
                                  {"id": "b", "status": "incomplete"}]}
        with patch.object(national_climate, "load_catalogue", return_value=places), \
             patch.object(national_climate.national_coverage, "build_report", return_value=coverage):
            result = national_climate.build(Path("unused.json"), Path("unused"))
        self.assertEqual(result["included_locations"], 0)
        self.assertEqual(result["skipped_locations"], ["a", "b"])
        self.assertFalse(result["complete"])


if __name__ == "__main__":
    unittest.main()
