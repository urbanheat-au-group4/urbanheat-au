"""Offline regression checks for provider throttling and request pacing."""
import unittest
from unittest.mock import patch
from urllib.error import HTTPError

import historical_weather as hist


class ThrottlingTests(unittest.TestCase):
    def test_retry_after_header_is_respected(self):
        place = {"id": "x", "name": "Test", "latitude": -37.0, "longitude": 145.0}
        delays = []
        error = HTTPError("https://archive-api.open-meteo.com", 429,
                          "Too Many Requests", {"Retry-After": "120"}, None)
        with patch.object(hist.time, "sleep", side_effect=delays.append), patch.object(hist.random, "uniform", return_value=0):
            with self.assertRaises(RuntimeError):
                hist.fetch_one(place, opener=lambda *_a, **_kw: (_ for _ in ()).throw(error), attempts=2)
        self.assertEqual(delays, [120.0])

    def test_nonretryable_client_error_does_not_sleep(self):
        place = {"id": "x", "name": "Test", "latitude": -37.0, "longitude": 145.0}
        error = HTTPError("https://archive-api.open-meteo.com", 400,
                          "Bad Request", {}, None)
        with patch.object(hist.time, "sleep") as pause:
            with self.assertRaises(RuntimeError):
                hist.fetch_one(place, opener=lambda *_a, **_kw: (_ for _ in ()).throw(error))
            pause.assert_not_called()


if __name__ == "__main__":
    unittest.main()
