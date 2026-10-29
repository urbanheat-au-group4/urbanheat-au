"""Summarise validated daily historical weather for annual and seasonal comparisons."""
import json
import math
from collections import defaultdict
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent
INPUT = ROOT / "historical_weather.json"
OUTPUT = ROOT / "climate_statistics.json"
FIELDS = ("temperature_2m_mean", "temperature_2m_max",
          "temperature_2m_min", "precipitation_sum")


def season(day):
    """Return Australian season and season year (December belongs to next summer)."""
    month = day.month
    if month in (12, 1, 2):
        return ("summer", day.year + (month == 12))
    if month in (3, 4, 5):
        return ("autumn", day.year)
    if month in (6, 7, 8):
        return ("winter", day.year)
    return ("spring", day.year)


def summarise(days, cold_night_below=5):
    """Never treat null readings as zero; report incomplete periods."""
    years = defaultdict(list)
    seasons = defaultdict(list)
    seen = set()
    for row in days:
        day = date.fromisoformat(row["date"])
        if row["date"] in seen:
            raise ValueError("Duplicate weather date")
        seen.add(row["date"])
        for field in FIELDS:
            value = row.get(field)
            if value is not None and (type(value) not in (int, float) or not math.isfinite(value)):
                raise ValueError("Invalid number in historical weather")
        years[day.year].append(row)
        seasons[season(day)].append(row)

    def stats(items, expected):
        values = {key: [row[key] for row in items if row.get(key) is not None] for key in FIELDS}
        maximum = values["temperature_2m_max"]
        minimum = values["temperature_2m_min"]
        return {
            "days_recorded": len(items),
            "expected_days": expected,
            "complete": len(items) == expected and all(len(values[f]) == expected for f in FIELDS),
            "coverage": {f: len(values[f]) for f in FIELDS},
            "mean_temperature_c": round(sum(values[FIELDS[0]]) / len(values[FIELDS[0]]), 3) if values[FIELDS[0]] else None,
            "average_max_c": round(sum(maximum) / len(maximum), 3) if maximum else None,
            "average_min_c": round(sum(minimum) / len(minimum), 3) if minimum else None,
            "days_at_least_30c": sum(v >= 30 for v in maximum),
            "days_at_least_35c": sum(v >= 35 for v in maximum),
            "nights_below_cold_threshold": sum(v < cold_night_below for v in minimum),
            "precipitation_mm": round(sum(values["precipitation_sum"]), 3) if values["precipitation_sum"] else None,
        }

    result_years = {}
    for year, items in sorted(years.items()):
        expected = (date(year + 1, 1, 1) - date(year, 1, 1)).days
        result_years[str(year)] = stats(items, expected)

    result_seasons = {}
    for (name, year), items in sorted(seasons.items(), key=lambda x: (x[0][1], x[0][0])):
        if name == "summer":
            start, end = date(year - 1, 12, 1), date(year, 3, 1)
        else:
            month = {"autumn": 3, "winter": 6, "spring": 9}[name]
            start = date(year, month, 1)
            end = date(year + 1, 1, 1) if month == 9 else date(year, month + 3, 1)
            if name == "spring":
                end = date(year, 12, 1)
        result_seasons[f"{year}-{name}"] = stats(items, (end - start).days)
    return {"years": result_years, "seasons": result_seasons,
            "cold_night_threshold_c": cold_night_below}


def main():
    from historical_weather import save_atomic
    data = json.loads(INPUT.read_text(encoding="utf-8"))
    output = {"source": data.get("source"), "model": data.get("model"),
              "timezone": data.get("timezone"), "start_date": data.get("start_date"),
              "end_date": data.get("end_date"), "locations": []}
    for loc in data["locations"]:
        row = {"id": loc["id"], "name": loc["name"]}
        row.update(summarise(loc["days"]))
        output["locations"].append(row)
    save_atomic(OUTPUT, output)
    print(f"Saved climate statistics for {len(output['locations'])} locations")


if __name__ == "__main__":
    main()
