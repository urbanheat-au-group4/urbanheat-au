"""Controlled Open-Meteo national archive smoke test.

Without --live, print requests only. With --live, fetch three regional samples,
validate the exact requested daily dates and values, and print evidence summary.
No writes to production snapshots; national_ingest remains the full ingest path.

python3 national_smoke.py
python3 national_smoke.py --live
"""
import argparse
from datetime import date, timedelta
import json
import math
from urllib.parse import urlencode
from urllib.request import urlopen

import historical_weather as hist
from location_catalogue import load_catalogue
from national_ingest import location_timezone

SAMPLE_IDS = ("melbourne-cbd", "brisbane", "perth")
START = date(2025, 1, 1)
END = date(2025, 1, 7)


def request_url(place):
    query = {
        "latitude": place["latitude"], "longitude": place["longitude"],
        "start_date": START.isoformat(), "end_date": END.isoformat(),
        "daily": ",".join(hist.FIELDS), "timezone": location_timezone(place),
        "models": hist.MODEL, "temperature_unit": "celsius",
        "precipitation_unit": "mm",
    }
    return hist.API_URL + "?" + urlencode(query)


def validate_sample(payload, place):
    if not isinstance(payload, dict) or payload.get("error"):
        raise ValueError("API returned an error")
    if payload.get("timezone") != location_timezone(place):
        raise ValueError("Timezone mismatch")
    if payload.get("daily_units") is None:
        raise ValueError("Missing daily units")
    daily = payload.get("daily")
    if not isinstance(daily, dict):
        raise ValueError("Missing daily series")
    dates = [(START + timedelta(days=i)).isoformat()
             for i in range((END - START).days + 1)]
    if daily.get("time") != dates:
        raise ValueError("Dates missing, duplicated or out of sequence")
    missing = 0
    for field, unit in zip(hist.FIELDS, hist.UNITS):
        if payload["daily_units"].get(field) != unit:
            raise ValueError(f"Unexpected unit for {field}")
        values = daily.get(field)
        if not isinstance(values, list) or len(values) != len(dates):
            raise ValueError(f"Missing series for {field}")
        for value in values:
            if value is None:
                missing += 1
            elif type(value) not in (int, float) or not math.isfinite(value):
                raise ValueError(f"Invalid numeric value in {field}")
            elif field == "precipitation_sum" and value < 0:
                raise ValueError("Negative precipitation")
    for i in range(len(dates)):
        low, mean, high = (daily[f][i] for f in
                           ("temperature_2m_min", "temperature_2m_mean", "temperature_2m_max"))
        if None not in (low, mean, high) and not low <= mean <= high:
            raise ValueError("Inconsistent temperatures")
    return {"id": place["id"], "state": place["state"],
            "timezone": location_timezone(place),
            "days": len(dates), "missing_measurements": missing}


def run(catalogue, live=False, opener=urlopen):
    places = {p["id"]: p for p in load_catalogue(catalogue, "australia_historical")}
    results = []
    for key in SAMPLE_IDS:
        place = places[key]
        url = request_url(place)
        if not live:
            results.append({"id": key, "status": "planned", "url": url})
            continue
        try:
            with opener(url, timeout=45) as response:
                checked = validate_sample(json.load(response), place)
            results.append({"status": "passed", **checked})
        except (OSError, ValueError, KeyError, TypeError) as exc:
            results.append({"id": key, "status": "failed", "error": str(exc)})
    return {"live": live, "source": hist.API_URL, "results": results,
            "passed": sum(r["status"] == "passed" for r in results),
            "expected": len(SAMPLE_IDS)}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--catalogue", default=hist.CATALOGUE)
    parser.add_argument("--live", action="store_true", help="Make actual HTTP requests")
    args = parser.parse_args(argv)
    result = run(args.catalogue, live=args.live)
    print(json.dumps(result, indent=2))
    return 0 if not args.live or result["passed"] == result["expected"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
