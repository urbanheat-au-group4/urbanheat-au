"""Export seasonal climate figures for the Seasonal Comparison view.

Run: py seasonal_export.py --data-dir data/national
Uses the saved snapshots only. No network requests.
A season-year only counts toward a typical value when EVERY day has a value
for that measure. Missing values are never treated as zero.
"""
import argparse
import json
from datetime import date, timedelta
from pathlib import Path

import climate_statistics
import historical_weather as hist
import national_ingest as ingest
from location_catalogue import load_catalogue

SEASONS = (
    ("summer", "Summer", "December to February"),
    ("autumn", "Autumn", "March to May"),
    ("winter", "Winter", "June to August"),
    ("spring", "Spring", "September to November"),
)
MEASURES = (
    ("max", "average_max_c", "temperature_2m_max"),
    ("min", "average_min_c", "temperature_2m_min"),
    ("precip", "precipitation_mm", "precipitation_sum"),
)


def season_period(name, year):
    """First and last day of a season. Summer 2016 runs Dec 2015 to Feb 2016."""
    if name == "summer":
        return date(year - 1, 12, 1), date(year, 3, 1) - timedelta(days=1)
    start = {"autumn": date(year, 3, 1), "winter": date(year, 6, 1),
             "spring": date(year, 9, 1)}[name]
    end = {"autumn": date(year, 6, 1), "winter": date(year, 9, 1),
           "spring": date(year, 12, 1)}[name] - timedelta(days=1)
    return start, end


def typical(values):
    return round(sum(values) / len(values), 2) if values else None


def build_seasons(season_stats):
    """Turn climate_statistics season rows into one entry per season."""
    result = []
    for name, label, months in SEASONS:
        years = []
        for key, row in season_stats.items():
            year_text, season_name = key.split("-")
            if season_name != name:
                continue
            start, end = season_period(name, int(year_text))
            years.append({
                "season_year": int(year_text),
                "period": start.isoformat() + " to " + end.isoformat(),
                "expected_days": row["expected_days"],
                "max_days": row["coverage"]["temperature_2m_max"],
                "min_days": row["coverage"]["temperature_2m_min"],
                "precip_days": row["coverage"]["precipitation_sum"],
                "average_max_c": row["average_max_c"],
                "average_min_c": row["average_min_c"],
                "precipitation_mm": row["precipitation_mm"],
            })
        years.sort(key=lambda y: y["season_year"])
        entry = {"season": name, "label": label, "months": months, "years": years}
        for short, value_key, field in MEASURES:
            days_key = short + "_days"
            used = [y for y in years if y[days_key] == y["expected_days"]]
            entry[short + "_years"] = [y["season_year"] for y in used]
            entry["typical_" + short] = typical([y[value_key] for y in used])
        result.append(entry)
    return result


def build(catalogue=hist.CATALOGUE, data_dir=Path("data/national")):
    places = load_catalogue(catalogue, ingest.GROUP_DEFAULT)
    rows, skipped = [], []
    for place in places:
        path = Path(data_dir) / "locations" / (place["id"] + ".json")
        if not ingest.valid_cached(path, place):
            skipped.append(place["id"])
            continue
        snapshot = json.loads(path.read_text(encoding="utf-8"))
        stats = climate_statistics.summarise(snapshot["data"]["days"])
        rows.append({"id": place["id"], "name": place["name"],
                     "state": place["state"],
                     "seasons": build_seasons(stats["seasons"])})
    return {
        "source": "Open-Meteo Historical Weather API",
        "model": hist.MODEL, "start_date": hist.START.isoformat(),
        "end_date": hist.END.isoformat(),
        "units": {"temperature": "°C", "precipitation": "mm"},
        "locations": rows, "skipped": skipped,
        "note": "Modelled historical estimates. Only seasons with a value for every day count toward a typical value.",
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", default="data/national")
    parser.add_argument("--output", default="static/national_seasons.json")
    args = parser.parse_args()
    result = build(data_dir=Path(args.data_dir))
    hist.save_atomic(Path(args.output), result)
    print(f"Seasonal data: {len(result['locations'])} locations saved to {args.output}")


if __name__ == "__main__":
    main()