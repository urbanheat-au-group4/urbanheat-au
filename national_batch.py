"""Download historical climate data in small, resumable batches.

Run: python3 national_batch.py --out data/national
Valid cached snapshots are reused. A rate limit stops further requests.
"""
import argparse
import json
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import urlopen

import historical_weather as hist
import national_ingest as ingest
from location_catalogue import load_catalogue

DEFAULT_BATCH_SIZE = 2
DEFAULT_DELAY = 8.0


def build_url(places):
    return hist.API_URL + "?" + urlencode({
        "latitude": ",".join(str(p["latitude"]) for p in places),
        "longitude": ",".join(str(p["longitude"]) for p in places),
        "timezone": ",".join(ingest.location_timezone(p) for p in places),
        "start_date": hist.START.isoformat(), "end_date": hist.END.isoformat(),
        "daily": ",".join(hist.FIELDS), "models": hist.MODEL,
        "temperature_unit": "celsius", "precipitation_unit": "mm",
    })


def chunks(items, size):
    for index in range(0, len(items), size):
        yield items[index:index + size]


def process(catalogue=hist.CATALOGUE, directory=Path("data/national"),
            opener=urlopen, batch_size=DEFAULT_BATCH_SIZE,
            delay=DEFAULT_DELAY, sleep=time.sleep):
    """Keep valid files, save each successful batch, and leave a final report."""
    if batch_size < 1 or batch_size > 5:
        raise ValueError("batch_size must be from 1 to 5")
    if delay < 0:
        raise ValueError("delay must not be negative")

    directory = Path(directory)
    places = load_catalogue(catalogue, "australia_historical")
    pending = [p for p in places if not ingest.valid_cached(
        directory / "locations" / (p["id"] + ".json"), p)]
    print(f"{len(places) - len(pending)} cached; {len(pending)} missing", flush=True)

    failed = []
    stopped = False
    reason = None
    attempted_batches = 0
    batches = list(chunks(pending, batch_size))

    for index, group in enumerate(batches):
        if index and delay:
            sleep(delay)
        attempted_batches += 1
        print(f"Batch {index + 1}/{len(batches)}: {len(group)} locations", flush=True)
        try:
            with opener(build_url(group), timeout=180) as response:
                data = json.load(response)
            # The provider returns an object for one location and a list for many.
            if len(group) == 1 and isinstance(data, dict):
                data = [data]
            if not isinstance(data, list) or len(data) != len(group):
                raise ValueError("Wrong number of locations in API response")
        except (HTTPError, URLError, TimeoutError, OSError, ValueError) as exc:
            failed.extend(p["id"] for p in group)
            print(f"Batch failed: {exc}", flush=True)
            if isinstance(exc, HTTPError) and exc.code in (400, 429):
                stopped = True
                reason = f"HTTP {exc.code}; stop requests and retry in a later run"
                print(reason, flush=True)
                break
            # A failed batch should not discard later locations.
            continue

        for place, payload in zip(group, data):
            try:
                checked = hist.validate(
                    payload, place, timezone_name=ingest.location_timezone(place))
                ingest.atomic_json(directory / "locations" / (place["id"] + ".json"), {
                    "signature": ingest.signature(place),
                    "source": "Open-Meteo Historical Weather API",
                    "model": hist.MODEL, "timezone": ingest.location_timezone(place),
                    "start_date": hist.START.isoformat(),
                    "end_date": hist.END.isoformat(),
                    "units": dict(zip(hist.FIELDS, hist.UNITS)),
                    "data": checked,
                })
                print(f'{place["id"]}: saved', flush=True)
            except (ValueError, TypeError, OSError, KeyError) as exc:
                failed.append(place["id"])
                print(f'{place["id"]}: invalid ({exc})', flush=True)

    # Check the disk again, not just API response counts: a later run can resume.
    completed = sum(ingest.valid_cached(
        directory / "locations" / (p["id"] + ".json"), p) for p in places)
    missing = [p["id"] for p in places if not ingest.valid_cached(
        directory / "locations" / (p["id"] + ".json"), p)]
    result = {
        "expected": len(places), "completed": completed,
        "failed": failed, "missing": missing,
        "attempted_batches": attempted_batches, "batch_size": batch_size,
        "stopped": stopped, "reason": reason,
    }
    ingest.atomic_json(directory / "batch_result.json", result)
    print(f'{completed}/{len(places)} validated snapshots; {len(missing)} missing',
          flush=True)
    return result


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=Path("data/national"))
    parser.add_argument("--batch-size", type=int, default=DEFAULT_BATCH_SIZE,
                        help="Locations per request, 1–5 (default 2)")
    parser.add_argument("--delay", type=float, default=DEFAULT_DELAY,
                        help="Seconds between requests (default 8)")
    args = parser.parse_args(argv)
    if not 1 <= args.batch_size <= 5:
        parser.error("--batch-size must be between 1 and 5")
    if args.delay < 0:
        parser.error("--delay must be non-negative")
    result = process(directory=args.out, batch_size=args.batch_size, delay=args.delay)
    return 0 if not result["missing"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
