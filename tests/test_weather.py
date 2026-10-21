"""Simple, offline checks for the dashboard weather contract."""
import unittest
import math

from weather import SUBURBS, validate_weather


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

    def test_wrong_units_are_rejected(self):
        data = sample_response()
        data[0]["current_units"]["temperature_2m"] = "°F"
        with self.assertRaises(ValueError):
            validate_weather(data)


if __name__ == "__main__":
    unittest.main()
