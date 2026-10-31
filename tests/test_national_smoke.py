"""Offline smoke-gate tests: no external API calls in CI."""
import io
import json
import unittest
from pathlib import Path

import national_smoke as smoke


CATALOGUE = Path(__file__).resolve().parents[1] / "locations.json"


class Response:
    def __init__(self, payload):
        self.payload = payload

    def __enter__(self):
        return io.BytesIO(json.dumps(self.payload).encode())

    def __exit__(self, *_args):
        return False


def payload(place):
    return {
        "timezone": smoke.location_timezone(place),
        "daily_units": dict(zip(smoke.hist.FIELDS, smoke.hist.UNITS)),
        "daily": {
            "time": [(smoke.START + smoke.timedelta(days=i)).isoformat() for i in range(7)],
            "temperature_2m_mean": [20.0] * 7,
            "temperature_2m_max": [25.0] * 7,
            "temperature_2m_min": [15.0] * 7,
            "precipitation_sum": [0.0] * 7,
        }
    }


class SmokeTests(unittest.TestCase):
    def test_dry_run_does_not_call_network(self):
        result = smoke.run(CATALOGUE, opener=lambda *_args, **_kwargs: self.fail("network"))
        self.assertEqual(result["passed"], 0)
        self.assertEqual([r["status"] for r in result["results"]], ["planned"] * 3)

    def test_live_fixture_across_three_timezones(self):
        places = {p["id"]: p for p in smoke.load_catalogue(CATALOGUE, "australia_historical")}
        items = iter([payload(places[k]) for k in smoke.SAMPLE_IDS])
        result = smoke.run(CATALOGUE, live=True,
                           opener=lambda *_args, **_kwargs: Response(next(items)))
        self.assertEqual(result["passed"], 3)
        self.assertEqual({r["timezone"] for r in result["results"]},
                         {"Australia/Melbourne", "Australia/Brisbane", "Australia/Perth"})

    def test_missing_day_rejected(self):
        place = smoke.load_catalogue(CATALOGUE, "melbourne_dashboard")[0]
        data = payload(place)
        data["daily"]["time"][3] = data["daily"]["time"][2]
        with self.assertRaisesRegex(ValueError, "Dates"):
            smoke.validate_sample(data, place)

    def test_bad_values_rejected(self):
        place = smoke.load_catalogue(CATALOGUE, "melbourne_dashboard")[0]
        data = payload(place)
        data["daily"]["precipitation_sum"][0] = -2
        with self.assertRaisesRegex(ValueError, "Negative"):
            smoke.validate_sample(data, place)


if __name__ == "__main__":
    unittest.main()
