"""Offline acceptance checks for exported national map data."""
import copy
import unittest

from national_map_audit import audit, METRICS


class MapAuditTests(unittest.TestCase):
    def setUp(self):
        self.catalogue = {"locations": []}
        self.export = {"locations": [], "count": 0}
        for code in ("NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"):
            for i in range(14):
                key = f"{code.lower()}-{i}"
                latitude = -20-i/10
                longitude = 125+i/10
                self.catalogue["locations"].append({
                    "id": key, "name": key, "state": code,
                    "groups": ["australia_historical"],
                    "latitude": latitude, "longitude": longitude,
                })
                row = {
                    "id": key, "name": key, "state": code,
                    "latitude": latitude, "longitude": longitude,
                    "x": round(36+(longitude-112)*928/42.5, 2),
                    "y": round(36+(-10-latitude)*688/34.5, 2),
                }
                row.update({metric: 15.0 for metric in METRICS})
                self.export["locations"].append(row)
        self.export["count"] = 112

    def test_complete_export(self):
        result = audit(self.catalogue, self.export)
        self.assertTrue(result["pass"], result["problems"])
        self.assertEqual(result["counts_by_state"]["VIC"], 14)

    def test_missing_record(self):
        self.export["locations"].pop()
        self.export["count"] = 111
        result = audit(self.catalogue, self.export)
        self.assertFalse(result["pass"])
        self.assertEqual(len(result["missing_ids"]), 1)

    def test_duplicate_record(self):
        self.export["locations"][0] = copy.deepcopy(self.export["locations"][1])
        result = audit(self.catalogue, self.export)
        self.assertFalse(result["pass"])
        self.assertTrue(any("Duplicate" in p for p in result["problems"]))

    def test_bad_projected_coordinate(self):
        self.export["locations"][0]["x"] += 100
        self.assertFalse(audit(self.catalogue, self.export)["pass"])

    def test_missing_real_measurement(self):
        self.export["locations"][0]["annual_mean_c"] = None
        self.assertFalse(audit(self.catalogue, self.export)["pass"])


if __name__ == "__main__":
    unittest.main()
