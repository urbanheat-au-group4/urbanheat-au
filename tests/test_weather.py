"""Tests for the weather data used by the dashboard."""
import unittest
import math

from weather import SUBURBS, validate_weather, validate_environment


def sample_response():
    return [
        {
            "latitude": lat,
            "longitude": lon,
            "current": {
                "time": "2026-10-20T06:00",
                "temperature_2m": 27.5,
                "apparent_temperature": 25.2,
                "relative_humidity_2m": 32,
            },
            "current_units": {
                "temperature_2m": "°C",
                "apparent_temperature": "°C",
                "relative_humidity_2m": "%",
            },
        }
        for lat, lon in SUBURBS.values()
    ]


class WeatherTests(unittest.TestCase):
    def test_six_suburbs_have_expected_fields(self):
        rows = validate_weather(sample_response())
        self.assertEqual(len(rows), 6)
        self.assertEqual(rows[0]["suburb"], "Melbourne CBD")
        self.assertIn("Belgrave", [r["suburb"] for r in rows])
        self.assertIn("Melton", [r["suburb"] for r in rows])
        self.assertEqual(rows[0]["temperature_c"], 27.5)

    def test_missing_temperature_is_rejected(self):
        data = sample_response()
        data[0]["current"]["temperature_2m"] = None
        with self.assertRaises(ValueError):
            validate_weather(data)

    def test_wrong_number_of_locations_is_rejected(self):
        with self.assertRaises(ValueError):
            validate_weather(sample_response()[:5])

    def test_nonfinite_readings_are_rejected(self):
        for invalid in (math.nan, math.inf, -math.inf):
            with self.subTest(value=invalid):
                data = sample_response()
                data[0]["current"]["temperature_2m"] = invalid
                with self.assertRaises(ValueError):
                    validate_weather(data)

    def test_invalid_model_coordinates_are_rejected(self):
        for field, invalid in (("latitude", 100), ("longitude", math.nan), ("latitude", None)):
            with self.subTest(field=field, value=invalid):
                data = sample_response()
                data[0][field] = invalid
                with self.assertRaises(ValueError):
                    validate_weather(data)

    def test_out_of_range_humidity_is_rejected(self):
        for invalid in (-1, 101):
            with self.subTest(value=invalid):
                data = sample_response()
                data[0]["current"]["relative_humidity_2m"] = invalid
                with self.assertRaises(ValueError):
                    validate_weather(data)

    def test_invalid_timestamp_is_rejected(self):
        data = sample_response()
        data[0]["current"]["time"] = "not-a-timestamp"
        with self.assertRaises(ValueError):
            validate_weather(data)

    def test_environment_values_are_validated(self):
        data = [{"current": {"time": "2026-10-22T01:00", "uv_index": 5.2, "pm2_5": 8.1},
                 "current_units": {"uv_index": "", "pm2_5": "μg/m³"}}
                for _ in SUBURBS]
        rows = validate_environment(data)
        self.assertEqual(len(rows), len(SUBURBS))
        self.assertEqual(rows[0]["uv_index"], 5.2)
        data[0]["current"]["pm2_5"] = -1
        with self.assertRaises(ValueError):
            validate_environment(data)

    def test_environment_accepts_index_and_micro_sign_units(self):
        data = [{"current": {"time": "2026-10-22T01:00", "uv_index": 6.4, "pm2_5": 7.2},
                 "current_units": {"uv_index": "Index", "pm2_5": "µg/m³"}}
                for _ in SUBURBS]
        result = validate_environment(data)
        self.assertEqual(result[0]["uv_index"], 6.4)
        self.assertEqual(result[0]["pm25_ug_m3"], 7.2)

    def test_environment_missing_values_are_optional(self):
        data = [{"current": {"time": "2026-10-22T01:00", "uv_index": None, "pm2_5": None},
                 "current_units": {"uv_index": "", "pm2_5": "μg/m³"}}
                for _ in SUBURBS]
        self.assertIsNone(validate_environment(data)[0]["uv_index"])

    def test_wrong_units_are_rejected(self):
        data = sample_response()
        data[0]["current_units"]["temperature_2m"] = "°F"
        with self.assertRaises(ValueError):
            validate_weather(data)


if __name__ == "__main__":
    unittest.main()
