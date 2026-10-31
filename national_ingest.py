"""Resumable per-location historical ingestion, isolated from the dashboard.

Run: python3 national_ingest.py --group australia_historical --out data/national
Default behaviour preserves verified snapshots and retries only missing/invalid ones.
Uses the existing Open-Meteo historical validator with jurisdiction-local
IANA timezone boundaries, leaving the six-location legacy importer unchanged.
"""
import argparse
import hashlib
import json
import math
import os
from pathlib import Path
from datetime import timedelta
import sys
import time

import historical_weather as hist
from location_catalogue import load_catalogue

FORMAT_VERSION = 2
STATE_TIMEZONES = {"VIC": "Australia/Melbourne", "NSW": "Australia/Sydney",
                   "ACT": "Australia/Sydney", "QLD": "Australia/Brisbane",
                   "WA": "Australia/Perth", "SA": "Australia/Adelaide",
                   "TAS": "Australia/Hobart", "NT": "Australia/Darwin"}


def location_timezone(place):
    return STATE_TIMEZONES[place["state"]]
GROUP_DEFAULT = "australia_historical"


def atomic_json(path, payload):
    """Persist one complete JSON object using the existing atomic writer."""
    path.parent.mkdir(parents=True, exist_ok=True)
    hist.save_atomic(path, payload)


def signature(place):
    """Invalidate cache when important location or modelling inputs change."""
    inputs = {
        "id": place["id"], "latitude": place["latitude"],
        "longitude": place["longitude"], "start": hist.START.isoformat(),
        "end": hist.END.isoformat(), "model": hist.MODEL,
        "fields": hist.FIELDS, "timezone": location_timezone(place),
        "version": FORMAT_VERSION,
    }
    return hashlib.sha256(json.dumps(inputs, sort_keys=True).encode()).hexdigest()


def valid_cached(path, place):
    """Reject truncated, duplicated or poisoned snapshots before reusing them."""
    if not path.is_file():
        return False
    try:
        obj = json.loads(path.read_text(encoding="utf-8"))
        series = obj["data"]
        days = series["days"]
        count = (hist.END - hist.START).days + 1
        if (obj.get("signature") != signature(place)
                or obj.get("model") != hist.MODEL
                or obj.get("timezone") != location_timezone(place)
                or obj.get("start_date") != hist.START.isoformat()
                or obj.get("end_date") != hist.END.isoformat()
                or obj.get("units") != dict(zip(hist.FIELDS, hist.UNITS))
                or series.get("id") != place["id"]
                or series.get("latitude") != place["latitude"]
                or series.get("longitude") != place["longitude"]
                or not isinstance(days, list) or len(days) != count):
            return False
        missing = 0
        for index, row in enumerate(days):
            if not isinstance(row, dict) or row.get("date") != (
                hist.START + timedelta(days=index)
            ).isoformat():
                return False
            for field in hist.FIELDS:
                value = row.get(field)
                if value is None:
                    missing += 1
                elif type(value) not in (int, float) or not math.isfinite(value):
                    return False
                elif field == "precipitation_sum" and value < 0:
                    return False
            values = [row.get(k) for k in ("temperature_2m_min", "temperature_2m_mean", "temperature_2m_max")]
            if all(v is not None for v in values) and not values[0] <= values[1] <= values[2]:
                return False
        return series.get("missing_values") == missing
    except (OSError, KeyError, TypeError, ValueError, IndexError, AttributeError):
        return False


def process(catalogue, directory, group=GROUP_DEFAULT, fetch=None, delay=8.0, sleep=time.sleep):
    """Process all locations independently, never discard a good older file."""
    places = load_catalogue(catalogue, group)
    directory = Path(directory)
    fetch = fetch or (lambda place: hist.fetch_one(place, timezone_name=location_timezone(place)))
    results = []
    last_request = None
    throttled = False
    for place in places:
        # IDs have been checked by the catalogue validator
        path = directory / "locations" / (place["id"] + ".json")
        status = "cached"
        error = None
        if not valid_cached(path, place) and throttled:
            status, error = "deferred", "Provider rate limit detected; resume in a later run"
        elif not valid_cached(path, place):
            if last_request is not None and delay > 0:
                sleep(delay)
            last_request = True
            status = "updated"
            try:
                validated = hist.validate(fetch(place), place, timezone_name=location_timezone(place))
                atomic_json(path, {
                    "signature": signature(place),
                    "source": "Open-Meteo Historical Weather API",
                    "model": hist.MODEL, "timezone": location_timezone(place),
                    "start_date": hist.START.isoformat(),
                    "end_date": hist.END.isoformat(),
                    "units": dict(zip(hist.FIELDS, hist.UNITS)),
                    "data": validated,
                })
            except (OSError, ValueError, RuntimeError, TypeError) as exc:
                status, error = "failed", str(exc)
                if "429" in str(exc) or "Too Many Requests" in str(exc):
                    throttled = True
                    print("HTTP 429: stopping further network requests; saved snapshots retained.", flush=True)
        results.append({"id": place["id"], "state": place["state"],
                        "status": status, "error": error})
        print(f'{place["id"]}: {status}' + (f" ({error})" if error else ""), flush=True)
    manifest = {
        "format_version": FORMAT_VERSION, "group": group,
        "model": hist.MODEL, "timezone_policy": "state_local",
        "start_date": hist.START.isoformat(), "end_date": hist.END.isoformat(),
        "throttled": throttled, "expected": len(results), "completed": sum(
            r["status"] in ("cached", "updated") for r in results),
        "locations": results,
        "limitations": "State capital IANA timezone is used for each locality; location-level timezone overrides and verified coordinates remain future work.",
    }
    atomic_json(directory / "manifest.json", manifest)
    return manifest


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--catalogue", type=Path, default=hist.CATALOGUE)
    parser.add_argument("--group", default=GROUP_DEFAULT)
    parser.add_argument("--out", type=Path, default=Path("data/national"))
    parser.add_argument("--delay", type=float, default=8.0,
                        help="Minimum pause in seconds between uncached locations (default 8)")
    args = parser.parse_args(argv)
    if args.delay < 0:
        parser.error("--delay must be non-negative")
    manifest = process(args.catalogue, args.out, args.group, delay=args.delay)
    print(f'Validated snapshots: {manifest["completed"]}/{manifest["expected"]}')
    return 0 if manifest["completed"] == manifest["expected"] else 1


if __name__ == "__main__":
    sys.exit(main())
