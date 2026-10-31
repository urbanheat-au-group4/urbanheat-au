"""Check the actual exported national map dataset before closing state tasks.

Run: python3 national_map_audit.py
Writes a report and returns nonzero when the export is not ready.
"""
import argparse
import json
import math
from collections import Counter
from pathlib import Path

METRICS = (
    "annual_mean_c", "annual_average_max_c", "annual_average_min_c",
    "average_annual_rainfall_mm", "average_days_at_least_35c",
)
STATES = ("NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT")


def geographic_warnings(catalogue):
    """Flag narrow sampling in a large state, without inventing measurements.

    This does not validate the underlying coordinates or certify state coverage.
    Small jurisdictions such as ACT are intentionally excluded.
    """
    warnings = []
    for state in ("NSW", "VIC", "QLD", "WA", "SA", "TAS", "NT"):
        places = [p for p in catalogue["locations"]
                  if p.get("state") == state and
                  "australia_historical" in p.get("groups", [])]
        if len(places) < 2:
            continue
        latitudes = [p["latitude"] for p in places]
        longitudes = [p["longitude"] for p in places]
        lat_span = max(latitudes) - min(latitudes)
        lon_span = max(longitudes) - min(longitudes)
        if lat_span < 1.5 and lon_span < 1.5:
            warnings.append({
                "state": state,
                "latitude_span_degrees": round(lat_span, 3),
                "longitude_span_degrees": round(lon_span, 3),
                "warning": "Locations are geographically clustered; this is not a statewide sample.",
            })
    return warnings


def audit(catalogue, exported):
    reference = {p["id"]: p for p in catalogue["locations"]
                 if "australia_historical" in p["groups"]}
    records = exported.get("locations", [])
    problems = []
    counts = Counter()
    seen = set()
    for p in records:
        key = p.get("id")
        if key in seen:
            problems.append(f"Duplicate export ID: {key}")
        seen.add(key)
        original = reference.get(key)
        if not original:
            problems.append(f"Unknown export ID: {key}")
            continue
        if p.get("state") != original["state"] or p.get("name") != original["name"]:
            problems.append(f"Incorrect name/state for {key}")
        counts[p["state"]] += 1
        for axis in ("latitude", "longitude"):
            value = p.get(axis)
            if not isinstance(value, (int, float)) or not math.isfinite(value) or abs(value-original[axis]) > 0.00001:
                problems.append(f"Incorrect {axis} for {key}")
        latitude, longitude = original["latitude"], original["longitude"]
        expected_x = 36 + (longitude-112)*928/42.5
        expected_y = 36 + (-10-latitude)*688/34.5
        for axis, expected in (("x", expected_x), ("y", expected_y)):
            value = p.get(axis)
            if not isinstance(value, (int, float)) or not math.isfinite(value) or abs(value-expected) > 0.02:
                problems.append(f"Incorrect projection {axis} for {key}")
        for field in METRICS:
            value = p.get(field)
            if not isinstance(value, (int, float)) or not math.isfinite(value):
                problems.append(f"Missing/invalid {field} for {key}")
    for code in STATES:
        if counts[code] != 14:
            problems.append(f"{code}: expected 14, got {counts[code]}")
    missing = sorted(set(reference)-seen)
    if missing:
        problems.append(f"Missing catalogue locations: {', '.join(missing)}")
    if exported.get("count") != len(records):
        problems.append("Reported count does not match export rows")
    return {
        "pass": not problems,
        "expected": len(reference),
        "exported": len(records),
        "counts_by_state": {code: counts[code] for code in STATES},
        "missing_ids": missing,
        "coverage_warnings": geographic_warnings(catalogue),
        "problems": problems,
        "scope": "Data completeness and projected marker consistency. Not a browser or independent geocoding check.",
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalogue", type=Path, default=Path("locations.json"))
    parser.add_argument("--data", type=Path, default=Path("static/national_data.json"))
    parser.add_argument("--output", type=Path, default=Path("data/national/map_audit.json"))
    args = parser.parse_args()
    if not args.data.is_file():
        parser.error("Map data is missing. Run python3 national_export.py first.")
    result = audit(json.loads(args.catalogue.read_text()), json.loads(args.data.read_text()))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + "\n")
    print(f'Map data: {result["exported"]}/{result["expected"]} | ' +
          ("PASS" if result["pass"] else "FAIL"))
    for problem in result["problems"]:
        print(" -", problem)
    for warning in result["coverage_warnings"]:
        print(" !", warning["state"], warning["warning"])
    print(f"Report: {args.output}")
    return 0 if result["pass"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
