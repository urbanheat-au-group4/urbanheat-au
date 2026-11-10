"""Check heat extremes and monthly daytime highs with small known examples."""
import unittest
from datetime import date, timedelta

from national_climate import heat_extremes


def row(day, high):
    return {"date": day, "temperature_2m_max": high}


class HeatExtremeTests(unittest.TestCase):
    def test_hottest_groups_use_the_correct_number_of_days(self):
        start = date(2020, 1, 1)
        days = [row((start + timedelta(days=i)).isoformat(), i + 1)
                for i in range(20)]
        result = heat_extremes(days)
        self.assertEqual(result["hottest_day_c"], 20)
        self.assertEqual(result["hottest_day_date"], "2020-01-20")
        self.assertEqual(result["hottest_10_percent_mean_c"], 19.5)
        self.assertEqual(result["hottest_25_percent_mean_c"], 18)
        self.assertEqual(result["hottest_50_percent_mean_c"], 15.5)

    def test_small_groups_round_up(self):
        days = [row(f"2020-01-0{i}", i) for i in range(1, 8)]
        result = heat_extremes(days)
        self.assertEqual(result["hottest_10_percent_mean_c"], 7)
        self.assertEqual(result["hottest_25_percent_mean_c"], 6.5)
        self.assertEqual(result["hottest_50_percent_mean_c"], 5.5)

    def test_months_combine_the_same_month_from_different_years(self):
        days = [row("2019-01-01", 30), row("2020-01-01", 40),
                row("2019-02-01", 20), row("2020-02-01", 24)]
        result = heat_extremes(days)
        self.assertEqual(len(result["monthly_average_max_c"]), 12)
        self.assertEqual(result["monthly_average_max_c"][:2], [35, 22])
        self.assertEqual(result["monthly_average_max_c"][2:], [None] * 10)

    def test_tied_hottest_day_uses_earliest_date(self):
        result = heat_extremes([row("2020-12-31", 44),
                                row("2020-01-03", 44)])
        self.assertEqual(result["hottest_day_date"], "2020-01-03")

    def test_missing_readings_are_not_zero(self):
        result = heat_extremes([row("2020-01-01", None)])
        self.assertIsNone(result["hottest_day_c"])
        self.assertIsNone(result["hottest_10_percent_mean_c"])
        self.assertEqual(result["monthly_average_max_c"], [None] * 12)


if __name__ == "__main__":
    unittest.main()
