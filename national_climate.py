"""Build national climate comparisons from checked historical snapshots.

Run: python3 national_climate.py --data-dir data/national
Only complete locations are included. No extra API requests.
"""
import argparse
import json
import math
from collections import defaultdict
from pathlib import Path

import climate_statistics
import historical_weather as hist
import national_coverage
from location_catalogue import load_catalogue



def heat_extremes(days):
    """Find the hottest days and typical daily highs for each month."""
    highs = []
    by_month = defaultdict(list)
    for row in days:
        value = row.get("temperature_2m_max")
        if type(value) not in (int, float) or not math.isfinite(value):
            continue
        highs.append((value, row["date"]))
        month = int(row["date"][5:7])
        by_month[month].append(value)

    if not highs:
        return {"hottest_day_c": None, "hottest_day_date": None,
                "hottest_10_percent_mean_c": None,
                "hottest_25_percent_mean_c": None,
                "hottest_50_percent_mean_c": None,
                "monthly_average_max_c": [None] * 12}

    # Sort hottest first. For a tied maximum, keep the earliest date.
    highs.sort(key=lambda item: (-item[0], item[1]))
    temperatures = [item[0] for item in highs]

    def hottest_fraction(fraction):
        count = math.ceil(len(temperatures) * fraction)
        return round(sum(temperatures[:count]) / count, 3)

    return {
        "hottest_day_c": highs[0][0],
        "hottest_day_date": highs[0][1],
        "hottest_10_percent_mean_c": hottest_fraction(0.10),
        "hottest_25_percent_mean_c": hottest_fraction(0.25),
        "hottest_50_percent_mean_c": hottest_fraction(0.50),
        "monthly_average_max_c": [
            round(sum(by_month[month]) / len(by_month[month]), 3)
            if by_month[month] else None for month in range(1, 13)
        ],
    }

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
        extremes = heat_extremes(snapshot["data"]["days"])
        rows.append({
            **extremes,
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
