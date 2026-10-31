"""Download and validate historical daily weather data for Melbourne."""
import json
import math
import os
import tempfile
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import urlopen

import weather
from location_catalogue import load_catalogue

ROOT = Path(__file__).resolve().parent
CATALOGUE = ROOT / "locations.json"
OUTPUT = ROOT / "historical_weather.json"
API_URL = "https://archive-api.open-meteo.com/v1/archive"
MODEL = "era5"
START = date(2015, 1, 1)
END = date(2025, 12, 31)
FIELDS = ("temperature_2m_mean", "temperature_2m_max",
          "temperature_2m_min", "precipitation_sum")
UNITS = ("°C", "°C", "°C", "mm")


def locations(group=None):
    """Use the current six locations by default; other groups are opt-in."""
    if CATALOGUE.exists():
        chosen = group if group is not None else os.getenv("URBANHEAT_LOCATION_GROUP", "melbourne_dashboard")
        records = load_catalogue(CATALOGUE, group=chosen)
        return [{"id": r["id"], "name": r["name"],
                 "latitude": r["latitude"], "longitude": r["longitude"]}
                for r in records]
    if group is not None and group != "melbourne_dashboard":
        raise ValueError("A catalogue is required for non-Melbourne groups")
    return [{"id": name.lower().replace(" ", "-"), "name": name,
             "latitude": lat, "longitude": lon}
            for name, (lat, lon) in weather.SUBURBS.items()]


def fetch_one(location, opener=urlopen, attempts=3, timezone_name="Australia/Melbourne"):
    """Retry transient failures a limited number of times."""
    params = {
        "latitude": location["latitude"],
        "longitude": location["longitude"],
        "start_date": START.isoformat(),
        "end_date": END.isoformat(),
        "daily": ",".join(FIELDS),
        "timezone": timezone_name,
        "models": MODEL,
        "temperature_unit": "celsius",
        "precipitation_unit": "mm",
    }
    url = API_URL + "?" + urlencode(params)
    for attempt in range(attempts):
        try:
            with opener(url, timeout=30) as response:
                return json.load(response)
        except (HTTPError, URLError, TimeoutError, OSError, ValueError) as exc:
            if attempt == attempts - 1:
                raise RuntimeError(f"{location['name']}: API failed after {attempts} attempts: {exc}") from exc
            time.sleep(min(2 ** attempt, 4))


def validate(payload, location, timezone_name="Australia/Melbourne"):
    """Reject incorrect dates and units; mark missing daily readings as null."""
    if not isinstance(payload, dict) or payload.get("error"):
        raise ValueError(f"{location['name']}: API error or invalid response")
    if payload.get("timezone") != timezone_name:
        raise ValueError(f"{location['name']}: incorrect timezone")
    daily, units = payload.get("daily"), payload.get("daily_units")
    if not isinstance(daily, dict) or not isinstance(units, dict):
        raise ValueError(f"{location['name']}: missing daily data or units")
    for field, unit in zip(FIELDS, UNITS):
        if units.get(field) != unit:
            raise ValueError(f"{location['name']}: wrong unit for {field}")
    dates = daily.get("time")
    expected = (END - START).days + 1
    if not isinstance(dates, list) or len(dates) != expected:
        raise ValueError(f"{location['name']}: incomplete date range")
    for field in FIELDS:
        if not isinstance(daily.get(field), list) or len(daily[field]) != expected:
            raise ValueError(f"{location['name']}: incomplete {field} series")
    result = []
    missing = 0
    for index, day in enumerate(dates):
        expected_day = (START + timedelta(days=index)).isoformat()
        if day != expected_day:
            raise ValueError(f"{location['name']}: date missing, duplicated or out of order")
        row = {"date": day}
        for field in FIELDS:
            value = daily[field][index]
            if value is None:
                missing += 1
                row[field] = None
            elif type(value) in (int, float) and math.isfinite(value):
                if field == "precipitation_sum" and value < 0:
                    raise ValueError(f"{location['name']}: negative precipitation")
                row[field] = value
            else:
                raise ValueError(f"{location['name']}: invalid {field} on {day}")
        if all(row[f] is not None for f in FIELDS):
            if not row["temperature_2m_min"] <= row["temperature_2m_mean"] <= row["temperature_2m_max"]:
                raise ValueError(f"{location['name']}: inconsistent temperatures on {day}")
        result.append(row)
    return {"id": location["id"], "name": location["name"],
            "latitude": location["latitude"], "longitude": location["longitude"],
            "missing_values": missing, "days": result}


def save_atomic(output, dataset):
    """Keep the previous valid dataset if saving fails."""
    temporary = None
    try:
        with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=output.parent,
                                         prefix=".history-", suffix=".tmp", delete=False) as file:
            temporary = Path(file.name)
            json.dump(dataset, file, indent=2)
            file.write("\n")
            file.flush()
            os.fsync(file.fileno())
        os.replace(temporary, output)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def main():
    try:
        places = locations()
        rows = []
        for place in places:
            print(f"Loading historical weather: {place['name']}")
            rows.append(validate(fetch_one(place), place))
        save_atomic(OUTPUT, {
            "source": "Open-Meteo Historical Weather API",
            "model": MODEL,
            "timezone": "Australia/Melbourne",
            "start_date": START.isoformat(),
            "end_date": END.isoformat(),
            "units": dict(zip(FIELDS, UNITS)),
            "retrieved_at_utc": datetime.now(timezone.utc).isoformat(),
            "locations": rows,
            "limitations": "Modelled reanalysis weather, not readings from local suburb sensors. Null values represent missing data.",
        })
    except (ValueError, RuntimeError, OSError, TypeError) as exc:
        print(f"Historical ingestion failed: {exc}")
        return 1
    print(f"Saved {len(rows)} locations to {OUTPUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
