"""Check the saved data, prepare the national dashboard and start the server.

Run: python3 run.py
Check the files without starting the website: python3 run.py --check
Historical data is downloaded separately so startup stays predictable.
"""

import argparse
import json
import subprocess
import sys
from pathlib import Path

from fetch_national_boundaries import validate as check_boundaries
from location_catalogue import load_catalogue

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data" / "national"
BOUNDARIES = ROOT / "static" / "australia_states.geojson"

EXPORT_SCRIPTS = (
    "national_export.py",
    "history_export.py",
    "seasonal_export.py",
)


def run_script(name):
    """Run a script in the project folder and stop if it fails."""
    print(f"Running {name}...", flush=True)
    result = subprocess.run([sys.executable, str(ROOT / name)], cwd=ROOT, check=False)
    if result.returncode:
        print(f"Could not finish {name}. Please check the error above.", file=sys.stderr)
        return False
    return True


def prepare():
    """Only use saved, checked weather readings. Do not invent missing data."""
    try:
        locations = load_catalogue(ROOT / "locations.json", "australia_historical")
    except (OSError, ValueError, KeyError, TypeError) as error:
        print(f"Could not read locations.json: {error}", file=sys.stderr)
        return False

    missing = [
        place["id"] for place in locations
        if not (DATA_DIR / "locations" / (place["id"] + ".json")).is_file()
    ]
    if missing:
        print(
            f"Historical weather files are missing for {len(missing)} of "
            f"{len(locations)} locations.", file=sys.stderr
        )
        print("Example missing location: " + missing[0], file=sys.stderr)
        print(
            "To download and resume saved readings, run:\n"
            "  python3 national_ingest.py --group australia_historical --out data/national\n"
            "It downloads up to five new locations per run. Repeat until all are saved.",
            file=sys.stderr
        )
        return False

    # A file may exist but contain missing days or incorrect values.
    if not run_script("national_coverage.py"):
        print("The saved weather data is incomplete. Check data/national/coverage.json.",
              file=sys.stderr)
        return False

    # The browser reads these three JSON files, not the raw daily snapshots.
    for name in EXPORT_SCRIPTS:
        if not run_script(name):
            return False

    # State outlines do not need downloading again if the saved file is valid.
    try:
        with BOUNDARIES.open(encoding="utf-8") as file:
            check_boundaries(json.load(file))
    except (OSError, ValueError, TypeError, KeyError, AttributeError):
        print("State boundaries are missing or invalid. Downloading them now...")
        if not run_script("fetch_national_boundaries.py"):
            print("Check your internet connection and try again.", file=sys.stderr)
            return False

    print("The national dashboard files are ready.", flush=True)
    return True


def main(argv=None):
    parser = argparse.ArgumentParser(description="Prepare and run UrbanHeat AU")
    parser.add_argument(
        "--check", action="store_true",
        help="Prepare and check the files without starting the website"
    )
    args = parser.parse_args(argv)

    if not prepare():
        return 1
    if args.check:
        return 0

    print("Open http://localhost:8000/ in your browser.", flush=True)
    return subprocess.run(
        [sys.executable, str(ROOT / "server.py")], cwd=ROOT, check=False
    ).returncode


if __name__ == "__main__":
    raise SystemExit(main())
