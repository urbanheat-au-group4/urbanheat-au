"""Checks for annual and seasonal climate calculations using known values."""
import unittest
from datetime import date, timedelta

from climate_statistics import season, summarise


def day(d, mean=20, high=30, low=5, rain=1):
    return {"date": d, "temperature_2m_mean": mean,
            "temperature_2m_max": high, "temperature_2m_min": low,
            "precipitation_sum": rain}


class ClimateTests(unittest.TestCase):
    def test_december_belongs_to_next_summer(self):
        self.assertEqual(season(date(2020, 12, 1)), ("summer", 2021))
        self.assertEqual(season(date(2021, 1, 1)), ("summer", 2021))
        self.assertEqual(season(date(2021, 2, 28)), ("summer", 2021))

    def test_hot_day_and_cold_night_boundaries(self):
        result = summarise([day("2020-01-01", high=30, low=5),
                            day("2020-01-02", high=35, low=4)])
        yr = result["years"]["2020"]
        self.assertEqual(yr["days_at_least_30c"], 2)
        self.assertEqual(yr["days_at_least_35c"], 1)
        self.assertEqual(yr["nights_below_cold_threshold"], 1)
        self.assertEqual(yr["precipitation_mm"], 2)

    def test_missing_measurement_not_counted_as_zero(self):
        result = summarise([day("2021-01-01", mean=None, high=None, rain=None)])
        yr = result["years"]["2021"]
        self.assertFalse(yr["complete"])
        self.assertEqual(yr["coverage"]["temperature_2m_mean"], 0)
        self.assertIsNone(yr["mean_temperature_c"])
        self.assertIsNone(yr["precipitation_mm"])

    def test_correct_annual_average(self):
        yr = summarise([day("2021-03-01", mean=10),
                        day("2021-03-02", mean=20)])["years"]["2021"]
        self.assertEqual(yr["mean_temperature_c"], 15)
        self.assertFalse(yr["complete"])

    def test_full_year_and_complete_summer(self):
        start, end = date(2020, 1, 1), date(2021, 12, 31)
        n = (end - start).days + 1
        rows = [day((start + timedelta(days=i)).isoformat()) for i in range(n)]
        result = summarise(rows)
        self.assertTrue(result["years"]["2020"]["complete"])
        self.assertTrue(result["years"]["2021"]["complete"])
        self.assertTrue(result["seasons"]["2021-summer"]["complete"])
        self.assertFalse(result["seasons"]["2020-summer"]["complete"])
        self.assertFalse(result["seasons"]["2022-summer"]["complete"])

    def test_duplicate_date_rejected(self):
        with self.assertRaises(ValueError):
            summarise([day("2020-01-01"), day("2020-01-01")])

    def test_incorrect_numeric_type_rejected(self):
        with self.assertRaises(ValueError):
            summarise([day("2020-01-01", mean="20")])


if __name__ == "__main__":
    unittest.main()
