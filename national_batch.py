"""Fetch all missing national historical locations in one Open-Meteo request.

Usage: python3 national_batch.py --out data/national
One network request only. Validates and saves each returned location separately.
"""
import argparse
import json
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen
from urllib.error import HTTPError, URLError

import historical_weather as hist
import national_ingest as ingest
from location_catalogue import load_catalogue


def build_url(places):
    return hist.API_URL + "?" + urlencode({
        "latitude": ",".join(str(p["latitude"]) for p in places),
        "longitude": ",".join(str(p["longitude"]) for p in places),
        "timezone": ",".join(ingest.location_timezone(p) for p in places),
        "start_date": hist.START.isoformat(), "end_date": hist.END.isoformat(),
        "daily": ",".join(hist.FIELDS), "models": hist.MODEL,
        "temperature_unit": "celsius", "precipitation_unit": "mm",
    })


def process(catalogue=hist.CATALOGUE, directory=Path("data/national"), opener=urlopen):
    directory = Path(directory)
    places = load_catalogue(catalogue, "australia_historical")
    pending = [p for p in places if not ingest.valid_cached(
        directory / "locations" / (p["id"] + ".json"), p)]
    print(f"{len(places) - len(pending)} cached; {len(pending)} missing", flush=True)
    if not pending:
        return {"expected": len(places), "completed": len(places), "failed": []}

    url = build_url(pending)
    print(f"Requesting {len(pending)} locations together", flush=True)
    try:
        with opener(url, timeout=180) as response:
            data = json.load(response)
    except (HTTPError, URLError, TimeoutError, OSError, ValueError) as exc:
        print(f"Batch failed: {exc}. Existing files unchanged.", flush=True)
        return {"expected": len(places), "completed": len(places) - len(pending),
                "failed": [p["id"] for p in pending]}

    # A multi-location response must contain exactly one entry per requested point.
    if not isinstance(data, list) or len(data) != len(pending):
        print("Unexpected batch response. Nothing saved.", flush=True)
        return {"expected": len(places), "completed": len(places) - len(pending),
                "failed": [p["id"] for p in pending]}

    failures = []
    for place, payload in zip(pending, data):
        try:
            checked = hist.validate(payload, place, timezone_name=ingest.location_timezone(place))
            ingest.atomic_json(directory / "locations" / (place["id"] + ".json"), {
                "signature": ingest.signature(place),
                "source": "Open-Meteo Historical Weather API",
                "model": hist.MODEL, "timezone": ingest.location_timezone(place),
                "start_date": hist.START.isoformat(), "end_date": hist.END.isoformat(),
                "units": dict(zip(hist.FIELDS, hist.UNITS)),
                "data": checked,
            })
            print(f'{place["id"]}: saved', flush=True)
        except (ValueError, TypeError, OSError, KeyError) as exc:
            failures.append(place["id"])
            print(f'{place["id"]}: failed ({exc})', flush=True)

    result = {"expected": len(places), "completed": len(places) - len(failures),
              "failed": failures}
    ingest.atomic_json(directory / "batch_result.json", result)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=Path("data/national"))
    args = parser.parse_args()
    result = process(directory=args.out)
    print(f'{result["completed"]}/{result["expected"]} downloaded')
    return 0 if not result["failed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
