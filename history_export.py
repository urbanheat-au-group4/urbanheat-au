"""Export year-by-year temperature figures for the Historical Trends chart.

Run: python3 history_export.py --data-dir data/national
Uses the saved snapshots only. No network requests. Missing values stay missing.
"""
import argparse
import json
from pathlib import Path

import climate_statistics
import historical_weather as hist
import national_ingest as ingest
from location_catalogue import load_catalogue


def build(catalogue=hist.CATALOGUE, data_dir=Path("data/national")):
    places = load_catalogue(catalogue, ingest.GROUP_DEFAULT)
    rows, skipped = [], []
    for place in places:
        path = Path(data_dir) / "locations" / (place["id"] + ".json")
        if not ingest.valid_cached(path, place):
            skipped.append(place["id"])
            continue
        snapshot = json.loads(path.read_text(encoding="utf-8"))
        years = climate_statistics.summarise(snapshot["data"]["days"])["years"]
        rows.append({
            "id": place["id"], "name": place["name"], "state": place["state"],
            "years": [{
                "year": int(year),
                "annual_mean_c": stats["mean_temperature_c"],
                "average_max_c": stats["average_max_c"],
                "mean_days": stats["coverage"]["temperature_2m_mean"],
                "expected_days": stats["expected_days"],
                "max_days": stats["coverage"]["temperature_2m_max"],
            } for year, stats in sorted(years.items())],
        })
    return {
        "source": "Open-Meteo Historical Weather API",
        "model": hist.MODEL,
        "start_date": hist.START.isoformat(),
        "end_date": hist.END.isoformat(),
        "units": "°C",
        "locations": rows,
        "skipped": skipped,
        "note": "Modelled historical estimates. A year marked incomplete uses only the days that have data.",
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", type=Path, default=Path("data/national"))
    parser.add_argument("--output", type=Path, default=Path("static/national_history.json"))
    args = parser.parse_args(argv)
    result = build(data_dir=args.data_dir)
    hist.save_atomic(args.output, result)
    print(f'History data: {len(result["locations"])} locations saved to {args.output}')
    return 0


if __name__ == "__main__":
    raise SystemExit(main())