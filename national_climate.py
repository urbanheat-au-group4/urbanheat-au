"""Build national climate comparisons from checked historical snapshots.

Run: python3 national_climate.py --data-dir data/national
Only complete locations are included. No extra API requests.
"""
import argparse
import json
from pathlib import Path

import climate_statistics
import historical_weather as hist
import national_coverage
from location_catalogue import load_catalogue


def build(catalogue, data_dir):
    places = load_catalogue(catalogue, "australia_historical")
    report = national_coverage.build_report(catalogue, data_dir)
    status = {item["id"]: item["status"] for item in report["locations"]}
    rows = []
    skipped = []
    for place in places:
        if status[place["id"]] != "complete":
            skipped.append(place["id"])
            continue
        file = Path(data_dir) / "locations" / (place["id"] + ".json")
        snapshot = json.loads(file.read_text(encoding="utf-8"))
        summary = climate_statistics.summarise(snapshot["data"]["days"])
        years = summary["years"]
        complete_years = [value for value in years.values() if value["complete"]]
        if len(complete_years) != hist.END.year - hist.START.year + 1:
            skipped.append(place["id"])
            continue
        rows.append({
            "id": place["id"], "name": place["name"], "state": place["state"],
            "annual_mean_c": round(sum(y["mean_temperature_c"] for y in complete_years) / len(complete_years), 3),
            "annual_average_max_c": round(sum(y["average_max_c"] for y in complete_years) / len(complete_years), 3),
            "annual_average_min_c": round(sum(y["average_min_c"] for y in complete_years) / len(complete_years), 3),
            "average_annual_rainfall_mm": round(sum(y["precipitation_mm"] for y in complete_years) / len(complete_years), 3),
            "average_days_at_least_35c": round(sum(y["days_at_least_35c"] for y in complete_years) / len(complete_years), 3),
            "years": years, "seasons": summary["seasons"],
        })
    return {
        "source": "Open-Meteo Historical Weather API",
        "model": hist.MODEL, "start_date": hist.START.isoformat(),
        "end_date": hist.END.isoformat(), "locations": rows,
        "skipped_locations": skipped,
        "expected_locations": len(places), "included_locations": len(rows),
        "complete": not skipped,
        "note": "Comparisons are from modelled historical data. Coordinates still need independent verification.",
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--catalogue", type=Path, default=hist.CATALOGUE)
    parser.add_argument("--data-dir", type=Path, default=Path("data/national"))
    parser.add_argument("--output", type=Path)
    args = parser.parse_args(argv)
    result = build(args.catalogue, args.data_dir)
    output = args.output or args.data_dir / "climate_comparison.json"
    hist.save_atomic(output, result)
    print(f'Climate comparisons: {result["included_locations"]}/{result["expected_locations"]}')
    print(f"Saved: {output}")
    return 0 if result["complete"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
