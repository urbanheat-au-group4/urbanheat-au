"""Assess per-year coverage of national historical snapshots without network calls.

Usage: python3 national_coverage.py --data-dir data/national
Results are a machine-readable report. Incomplete datasets are not treated as
successful observations. Coordinates must be verified separately.
"""
import argparse
from collections import Counter
from datetime import date, timedelta
import json
import math
from pathlib import Path

import historical_weather as hist
from location_catalogue import load_catalogue
from national_ingest import signature, location_timezone

FIELDS = hist.FIELDS


def expected_dates(year):
    start, end = max(date(year, 1, 1), hist.START), min(date(year, 12, 31), hist.END)
    if start > end:
        return []
    return [(start + timedelta(days=n)).isoformat() for n in range((end - start).days + 1)]


def evaluate_year(days, year):
    """Count unique valid date buckets and usable measurements for a year."""
    expected = set(expected_dates(year))
    seen = set()
    duplicates = 0
    invalid_dates = 0
    missing = Counter()
    invalid_values = Counter()
    for row in days:
        if not isinstance(row, dict):
            invalid_dates += 1
            continue
        day = row.get("date")
        if not isinstance(day, str):
            invalid_dates += 1
            continue
        try:
            parsed = date.fromisoformat(day)
        except ValueError:
            invalid_dates += 1
            continue
        if parsed.year != year:
            continue
        if day not in expected:
            invalid_dates += 1
            continue
        if day in seen:
            duplicates += 1
            continue
        seen.add(day)
        for field in FIELDS:
            value = row.get(field)
            if value is None:
                missing[field] += 1
            elif type(value) not in (int, float) or not math.isfinite(value):
                invalid_values[field] += 1
            elif field == "precipitation_sum" and value < 0:
                invalid_values[field] += 1
    missing_days = len(expected - seen)
    usable_days = len(seen)
    status = ("complete" if not missing_days and not duplicates and not invalid_dates
              and not any(missing.values()) and not any(invalid_values.values())
              else "incomplete")
    return {
        "year": year, "expected_days": len(expected), "retrieved_unique_days": usable_days,
        "missing_days": missing_days, "duplicate_days": duplicates,
        "invalid_date_rows": invalid_dates,
        "missing_values": {f: missing[f] for f in FIELDS},
        "invalid_values": {f: invalid_values[f] for f in FIELDS},
        "status": status,
    }


def assess_location(location, directory):
    path = Path(directory) / "locations" / (location["id"] + ".json")
    errors = []
    days = []
    if not path.is_file():
        errors.append("snapshot_missing")
    else:
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
            data = payload["data"]
            if data.get("id") != location["id"]:
                errors.append("location_id_mismatch")
            if payload.get("signature") != signature(location):
                errors.append("snapshot_signature_mismatch")
            if payload.get("model") != hist.MODEL:
                errors.append("model_mismatch")
            if payload.get("timezone") != location_timezone(location):
                errors.append("timezone_mismatch")
            if payload.get("start_date") != hist.START.isoformat() or payload.get("end_date") != hist.END.isoformat():
                errors.append("period_mismatch")
            if payload.get("units") != dict(zip(hist.FIELDS, hist.UNITS)):
                errors.append("units_mismatch")
            days = data["days"]
            if not isinstance(days, list):
                raise ValueError("days must be list")
        except (OSError, ValueError, TypeError, KeyError, AttributeError):
            errors.append("snapshot_malformed")
    years = [evaluate_year(days, year) for year in range(hist.START.year, hist.END.year + 1)]
    complete = not errors and all(y["status"] == "complete" for y in years)
    return {
        "id": location["id"], "name": location["name"], "state": location["state"],
        "status": "complete" if complete else "incomplete", "errors": errors,
        "years": years,
    }


def build_report(catalogue, directory, group="australia_historical"):
    locations = load_catalogue(catalogue, group)
    assessed = [assess_location(loc, directory) for loc in locations]
    totals = Counter(x["status"] for x in assessed)
    return {
        "source": "Open-Meteo Historical Weather API",
        "model": hist.MODEL, "timezone_policy": "state_local",
        "start_date": hist.START.isoformat(), "end_date": hist.END.isoformat(),
        "group": group, "expected_locations": len(locations),
        "complete_locations": totals["complete"],
        "incomplete_locations": totals["incomplete"],
        "coverage_status": "complete" if totals["complete"] == len(locations) else "incomplete",
        "limitations": "Missing, invalid or incomplete daily data are reported, never imputed. National days follow the jurisdiction IANA timezone.",
        "locations": assessed,
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--catalogue", type=Path, default=hist.CATALOGUE)
    parser.add_argument("--data-dir", type=Path, default=Path("data/national"))
    parser.add_argument("--group", default="australia_historical")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args(argv)
    report = build_report(args.catalogue, args.data_dir, args.group)
    output = args.output or args.data_dir / "coverage.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    hist.save_atomic(output, report)
    print(f'Coverage: {report["complete_locations"]}/{report["expected_locations"]} complete')
    print(f'Report: {output}')
    return 0 if report["coverage_status"] == "complete" else 1


if __name__ == "__main__":
    raise SystemExit(main())
