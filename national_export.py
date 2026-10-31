"""Export the national results for the separate map page."""
import argparse
import json
from pathlib import Path
from national_climate import build
from national_map import markers
from historical_weather import CATALOGUE, save_atomic

def export(catalogue=CATALOGUE, data_dir=Path("data/national"), output=Path("static/national_data.json")):
    climate = build(catalogue, data_dir)
    points = {p["id"]: p for p in markers(catalogue)}
    rows = []
    for record in climate["locations"]:
        point = points[record["id"]]
        rows.append({k: record[k] for k in
                     ("id", "name", "state", "annual_mean_c", "annual_average_max_c",
                      "annual_average_min_c", "average_annual_rainfall_mm",
                      "average_days_at_least_35c")})
        rows[-1].update({"x": point["x"], "y": point["y"]})
    result = {"locations": rows, "count": len(rows),
              "source": climate["source"], "start_date": climate["start_date"],
              "end_date": climate["end_date"], "skipped": climate["skipped_locations"]}
    save_atomic(output, result)
    return result

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--data-dir", type=Path, default=Path("data/national"))
    p.add_argument("--output", type=Path, default=Path("static/national_data.json"))
    args = p.parse_args()
    result = export(data_dir=args.data_dir, output=args.output)
    print(f'National map data: {result["count"]}/112 locations')
    raise SystemExit(0 if result["count"] == 112 else 1)
