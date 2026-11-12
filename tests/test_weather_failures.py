"""Deterministic ingestion regression tests for UrbanHeat AU.

Run: python3 -m unittest discover -s tests -p 'test_weather_failures.py' -v
"""
import copy
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError, URLError

import weather


def valid_api_response():
    rows = []
    for lat, lon in weather.SUBURBS.values():
        rows.append({
            "latitude": lat, "longitude": lon,
            "current": {
                "temperature_2m": 24.5,
                "apparent_temperature": 25.0,
                "relative_humidity_2m": 55,
                "time": "2026-10-28T06:00",
            },
            "current_units": {
                "temperature_2m": "°C",
                "apparent_temperature": "°C",
                "relative_humidity_2m": "%",
            }
        })
    return rows


class TestWeatherValidation(unittest.TestCase):
    def setUp(self):
        self.payload = valid_api_response()

    def test_valid_six(self):
        self.assertEqual(len(weather.validate_weather(self.payload)), len(weather.SUBURBS))

    def test_missing_current_fields(self):
        for field in ("temperature_2m", "apparent_temperature", "relative_humidity_2m", "time"):
            with self.subTest(field=field):
                p = copy.deepcopy(self.payload)
                del p[0]["current"][field]
                with self.assertRaises(ValueError):
                    weather.validate_weather(p)

    def test_missing_location_coordinates(self):
        for field in ("latitude", "longitude"):
            with self.subTest(field=field):
                p = copy.deepcopy(self.payload)
                del p[0][field]
                with self.assertRaises(ValueError):
                    weather.validate_weather(p)

    def test_invalid_temperature_types(self):
        for value in (None, "24.5", True, float("nan"), float("inf")):
            with self.subTest(value=str(value)):
                p = copy.deepcopy(self.payload)
                p[0]["current"]["temperature_2m"] = value
                with self.assertRaises(ValueError):
                    weather.validate_weather(p)

    def test_wrong_measurement_units(self):
        for field, unit in (("temperature_2m", "°F"), ("apparent_temperature", "K"),
                            ("relative_humidity_2m", "fraction")):
            with self.subTest(field=field):
                p = copy.deepcopy(self.payload)
                p[0]["current_units"][field] = unit
                with self.assertRaises(ValueError):
                    weather.validate_weather(p)

    def test_invalid_coordinates(self):
        for field, value in (("latitude", 91), ("longitude", 181),
                             ("latitude", None), ("longitude", "145")):
            with self.subTest(field=field, value=value):
                p = copy.deepcopy(self.payload)
                p[0][field] = value
                with self.assertRaises(ValueError):
                    weather.validate_weather(p)

    def test_wrong_number_of_locations(self):
        for p in (self.payload[:-1], self.payload + [copy.deepcopy(self.payload[0])]):
            with self.assertRaises(ValueError):
                weather.validate_weather(p)

    def test_malformed_timestamp(self):
        p = copy.deepcopy(self.payload)
        p[0]["current"]["time"] = "not-a-date"
        with self.assertRaises(ValueError):
            weather.validate_weather(p)

    def test_missing_current_or_units(self):
        for field in ("current", "current_units"):
            p = copy.deepcopy(self.payload)
            del p[0][field]
            with self.assertRaises(ValueError):
                weather.validate_weather(p)


class TestIngestionFailureProtection(unittest.TestCase):
    def check_preserved(self, error):
        with tempfile.TemporaryDirectory() as root:
            output = Path(root) / "weather_data.json"
            old = '{"sentinel": "last-valid-data"}\n'
            output.write_text(old)
            with patch.object(weather, "OUTPUT_FILE", output), patch.object(weather, "get_weather", side_effect=error):
                self.assertEqual(weather.main(), 1)
            self.assertEqual(output.read_text(), old)

    def test_timeout_preserves_previous(self):
        self.check_preserved(TimeoutError("timed out"))

    def test_http_error_preserves_previous(self):
        self.check_preserved(HTTPError("https://example.invalid", 503, "Unavailable", None, None))

    def test_network_error_preserves_previous(self):
        self.check_preserved(URLError("network down"))

    def test_malformed_json_preserves_previous(self):
        self.check_preserved(json.JSONDecodeError("invalid", "{", 1))

    def test_invalid_payload_preserves_previous(self):
        with tempfile.TemporaryDirectory() as root:
            output = Path(root) / "weather_data.json"
            output.write_text("previous valid data")
            with patch.object(weather, "OUTPUT_FILE", output), patch.object(weather, "get_weather", return_value=valid_api_response()[:-1]):
                self.assertEqual(weather.main(), 1)
            self.assertEqual(output.read_text(), "previous valid data")


class TestSavedRefresh(unittest.TestCase):
    def test_success_replaces_saved_readings(self):
        with tempfile.TemporaryDirectory() as root:
            output = Path(root) / "weather_data.json"
            output.write_text('previous snapshot')
            with patch.object(weather, "OUTPUT_FILE", output), patch.object(weather, "get_weather", return_value=valid_api_response()), patch.object(weather, "get_environment", side_effect=URLError("optional data unavailable")):
                self.assertEqual(weather.main(), 0)
            saved = json.loads(output.read_text())
            self.assertEqual(len(saved["locations"]), 6)
            self.assertEqual(saved["locations"][0]["temperature_c"], 24.5)
            self.assertIsNone(saved["locations"][0]["pm25_ug_m3"])
            self.assertEqual(list(Path(root).iterdir()), [output])

    def test_save_failures_preserve_bytes_and_clean_temporary_file(self):
        for operation in ("fsync", "replace"):
            with self.subTest(operation=operation), tempfile.TemporaryDirectory() as root:
                output = Path(root) / "weather_data.json"
                previous = b'{"last": "successful snapshot"}\n'
                output.write_bytes(previous)
                with patch.object(weather, "OUTPUT_FILE", output), patch.object(weather, "get_weather", return_value=valid_api_response()), patch.object(weather, "get_environment", side_effect=URLError("optional data unavailable")), patch.object(weather.os, operation, side_effect=OSError("disk unavailable")), patch("builtins.print") as log:
                    self.assertEqual(weather.main(), 1)
                self.assertEqual(output.read_bytes(), previous)
                self.assertEqual(list(Path(root).iterdir()), [output])
                self.assertTrue(any("Could not save weather data: disk unavailable" in str(call) for call in log.call_args_list))


if __name__ == "__main__":
    unittest.main()
