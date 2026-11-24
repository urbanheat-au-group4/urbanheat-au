"""Save the national map values used by the website."""
import argparse
from collections import Counter
from pathlib import Path

from historical_weather import CATALOGUE, save_atomic
from national_climate import build
from national_map import STATES, markers

# These are the climate values shown when a location is selected.
CLIMATE_FIELDS = (
    "id", "name", "state",
    "annual_mean_c", "annual_average_max_c", "annual_average_min_c",
    "average_annual_rainfall_mm", "average_days_at_least_35c",
)
EXTRA_FIELDS = (
    "hottest_day_c", "hottest_day_date",
    "hottest_10_percent_mean_c", "hottest_25_percent_mean_c",
    "hottest_50_percent_mean_c", "monthly_average_max_c",
)


def export(catalogue=CATALOGUE, data_dir=Path("data/national"),
           output=Path("static/national_data.json")):
    """Join each checked climate record to its location on the map."""
    climate = build(catalogue, data_dir)
    points = {point["id"]: point for point in markers(catalogue)}
    rows = []

    for record in climate["locations"]:
        point = points[record["id"]]
        row = {name: record[name] for name in CLIMATE_FIELDS}
        for name in EXTRA_FIELDS:
            row[name] = record.get(name)

        for name in ("x", "y", "latitude", "longitude"):
            row[name] = point[name]
        rows.append(row)

    counts = Counter(row["state"] for row in rows)
    result = {
        "locations": rows,
        "count": len(rows),
        "state_counts": {state: counts[state] for state in STATES},
        "source": climate["source"],
        "model": climate["model"],
        "start_date": climate["start_date"],
        "end_date": climate["end_date"],
        "skipped": climate["skipped_locations"],
    }
    save_atomic(output, result)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", type=Path, default=Path("data/national"))
    parser.add_argument("--output", type=Path, default=Path("static/national_data.json"))
    args = parser.parse_args()

    result = export(data_dir=args.data_dir, output=args.output)
    print(f'National map data: {result["count"]}/112 locations')
    return 0 if result["count"] == 112 else 1


if __name__ == "__main__":
    raise SystemExit(main())
