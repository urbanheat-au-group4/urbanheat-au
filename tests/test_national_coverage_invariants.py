"""Check that damaged temperatures are not accepted as complete data."""
import unittest
from datetime import date, timedelta

import national_coverage as coverage


def valid_year(year=2015):
    start, end = date(year, 1, 1), date(year + 1, 1, 1)
    return [
        {
            "date": (start + timedelta(days=i)).isoformat(),
            "temperature_2m_min": 15.0,
            "temperature_2m_mean": 20.0,
            "temperature_2m_max": 25.0,
            "precipitation_sum": 1.0,
        }
        for i in range((end - start).days)
    ]


class CoverageTemperatureOrderRegression(unittest.TestCase):
    def test_valid_full_year_is_complete(self):
        rows = valid_year()
        result = coverage.evaluate_year(rows, 2015)
        self.assertEqual(result["status"], "complete")
        self.assertEqual(result["expected_days"], 365)
        self.assertEqual(result["missing_days"], 0)

    def test_negative_rainfall_is_rejected(self):
        rows = valid_year()
        rows[0]["precipitation_sum"] = -1.0
        result = coverage.evaluate_year(rows, 2015)
        self.assertEqual(result["status"], "incomplete")
        self.assertEqual(result["invalid_values"]["precipitation_sum"], 1)

    def test_minimum_greater_than_mean_is_rejected(self):
        rows = valid_year()
        rows[0]["temperature_2m_min"] = 30.0
        result = coverage.evaluate_year(rows, 2015)
        self.assertEqual(result["status"], "incomplete")

    def test_mean_greater_than_maximum_is_rejected(self):
        rows = valid_year()
        rows[0]["temperature_2m_mean"] = 31.0
        result = coverage.evaluate_year(rows, 2015)
        self.assertEqual(result["status"], "incomplete")


if __name__ == "__main__":
    unittest.main()
