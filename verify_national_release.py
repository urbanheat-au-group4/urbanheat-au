"""Audit local historical snapshots and dashboard exports without downloading anything.

Run after: python3 run.py --check
Then: python3 verify_national_release.py
Exits non-zero if coverage or exported results are missing/inconsistent.
This does not establish geographical coordinate accuracy or accessibility.
"""
import argparse
import json
from collections import Counter
from pathlib import Path

import historical_weather as hist
import national_coverage
from location_catalogue import load_catalogue

STATES = ("NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT")
EXPORTS = {
    "map": "national_data.json",
    "history": "national_history.json",
    "seasons": "national_seasons.json",
}


def audit(catalogue=hist.CATALOGUE, data_dir=Path("data/national"),
          static_dir=Path("static")):
    """Return factual pass/fail results; never change exported files."""
    places = load_catalogue(catalogue, "australia_historical")
    wanted = {p["id"] for p in places}
    checks = {}
    problems = []
    coverage = national_coverage.build_report(catalogue, data_dir)
    checks["coverage"] = {
        "complete": coverage["complete_locations"],
        "expected": coverage["expected_locations"],
    }
    if coverage["complete_locations"] != len(places):
        problems.append(f"Only {coverage['complete_locations']}/{len(places)} snapshots have complete daily coverage")

    catalogue_states = Counter(p["state"] for p in places)
    if len(places) == 112 and any(catalogue_states[code] != 14 for code in STATES):
        problems.append("Catalogue does not contain exactly 14 places in every jurisdiction")

    for label, filename in EXPORTS.items():
        path = Path(static_dir) / filename
        if not path.is_file():
            problems.append(f"{label}: missing {path}")
            continue
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            rows = data["locations"]
            ids = [row["id"] for row in rows]
            if not isinstance(rows, list) or len(ids) != len(set(ids)):
                raise ValueError("duplicate location IDs or malformed locations")
            present = set(ids)
            checks[label] = {
                "locations": len(ids),
                "model": data.get("model"),
                "start_date": data.get("start_date"),
                "end_date": data.get("end_date"),
                "missing_ids": sorted(wanted - present),
                "extra_ids": sorted(present - wanted),
            }
            if present != wanted:
                problems.append(f"{label}: catalogue and export location IDs disagree")
            if (data.get("model") != hist.MODEL
                    or data.get("start_date") != hist.START.isoformat()
                    or data.get("end_date") != hist.END.isoformat()):
                problems.append(f"{label}: model or historical period does not match")
            if data.get("skipped"):
                problems.append(f"{label}: skipped {len(data['skipped'])} locations")
            if label == "map":
                if data.get("count") != len(ids):
                    problems.append("map: count disagrees with location rows")
                for row in rows:
                    if not isinstance(row.get("monthly_average_max_c"), list) or len(row["monthly_average_max_c"]) != 12:
                        problems.append(f"map: {row['id']} has no 12-month daily-high chart series")
                        break
                if len(places) == 112 and any(data.get("state_counts", {}).get(state) != 14 for state in STATES):
                    problems.append("map: expected 14 exported locations per state/territory")
            if label == "history" and any(len(row.get("years", [])) != hist.END.year - hist.START.year + 1 for row in rows):
                problems.append("history: at least one location has missing annual records")
            if label == "seasons" and any(len(row.get("seasons", [])) != 4 for row in rows):
                problems.append("seasons: at least one location has missing seasonal summaries")
        except (OSError, ValueError, TypeError, KeyError) as exc:
            problems.append(f"{label}: cannot inspect {path}: {exc}")

    return {
        "pass": not problems,
        "expected_locations": len(places),
        "checks": checks,
        "problems": problems,
        "limitations": (
            "Verifies local file coverage, structure and metadata only. "
            "Does not independently verify real-world coordinates, model accuracy, "
            "screen-reader accessibility or manual browser appearance."
        ),
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--catalogue", type=Path, default=hist.CATALOGUE)
    parser.add_argument("--data-dir", type=Path, default=Path("data/national"))
    parser.add_argument("--static-dir", type=Path, default=Path("static"))
    parser.add_argument("--output", type=Path, default=Path("artifacts/uha-46-export-audit.json"))
    args = parser.parse_args(argv)
    result = audit(args.catalogue, args.data_dir, args.static_dir)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    hist.save_atomic(args.output, result)
    for name, check in result["checks"].items():
        print(f"{name}: {check}")
    for problem in result["problems"]:
        print("FAIL:", problem)
    print("PASS" if result["pass"] else "FAIL", "Local release audit:", args.output)
    return 0 if result["pass"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
