"""Resumable per-location historical ingestion, isolated from the dashboard.

Run: python3 national_ingest.py --group australia_historical --out data/national
Default behaviour preserves verified snapshots and retries only missing/invalid ones.
Uses the existing Open-Meteo historical validator and its Melbourne-aligned day
boundary; a per-state local-day policy must be approved before national analysis.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import sys

import historical_weather as hist
from location_catalogue import load_catalogue

FORMAT_VERSION = 1
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
        "fields": hist.FIELDS, "timezone": "Australia/Melbourne",
        "version": FORMAT_VERSION,
    }
    return hashlib.sha256(json.dumps(inputs, sort_keys=True).encode()).hexdigest()


def valid_cached(path, place):
    if not path.is_file():
        return False
    try:
        obj = json.loads(path.read_text(encoding="utf-8"))
        series = obj["data"]
        days = series["days"]
        return (obj["signature"] == signature(place)
                and series["id"] == place["id"]
                and len(days) == (hist.END - hist.START).days + 1
                and days[0]["date"] == hist.START.isoformat()
                and days[-1]["date"] == hist.END.isoformat())
    except (OSError, KeyError, TypeError, ValueError, IndexError):
        return False


def process(catalogue, directory, group=GROUP_DEFAULT, fetch=None):
    """Process all locations independently, never discard a good older file."""
    places = load_catalogue(catalogue, group)
    directory = Path(directory)
    fetch = fetch or hist.fetch_one
    results = []
    for place in places:
        # IDs have been checked by the catalogue validator
        path = directory / "locations" / (place["id"] + ".json")
        status = "cached"
        error = None
        if not valid_cached(path, place):
            status = "updated"
            try:
                validated = hist.validate(fetch(place), place)
                atomic_json(path, {
                    "signature": signature(place),
                    "source": "Open-Meteo Historical Weather API",
                    "model": hist.MODEL, "timezone": "Australia/Melbourne",
                    "start_date": hist.START.isoformat(),
                    "end_date": hist.END.isoformat(),
                    "units": dict(zip(hist.FIELDS, hist.UNITS)),
                    "data": validated,
                })
            except (OSError, ValueError, RuntimeError, TypeError) as exc:
                status, error = "failed", str(exc)
        results.append({"id": place["id"], "state": place["state"],
                        "status": status, "error": error})
        print(f'{place["id"]}: {status}' + (f" ({error})" if error else ""), flush=True)
    manifest = {
        "format_version": FORMAT_VERSION, "group": group,
        "model": hist.MODEL, "timezone": "Australia/Melbourne",
        "start_date": hist.START.isoformat(), "end_date": hist.END.isoformat(),
        "expected": len(results), "completed": sum(
            r["status"] in ("cached", "updated") for r in results),
        "locations": results,
        "limitations": "Shared Melbourne-day timezone; do not infer local-calendar-day statistics across all Australian jurisdictions.",
    }
    atomic_json(directory / "manifest.json", manifest)
    return manifest


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--catalogue", type=Path, default=hist.CATALOGUE)
    parser.add_argument("--group", default=GROUP_DEFAULT)
    parser.add_argument("--out", type=Path, default=Path("data/national"))
    args = parser.parse_args(argv)
    manifest = process(args.catalogue, args.out, args.group)
    print(f'Validated snapshots: {manifest["completed"]}/{manifest["expected"]}')
    return 0 if manifest["completed"] == manifest["expected"] else 1


if __name__ == "__main__":
    sys.exit(main())
