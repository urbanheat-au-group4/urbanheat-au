"""Get weather data for the six Melbourne locations and check it is valid."""

import json
import math
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import urlopen

API_URL = "https://api.open-meteo.com/v1/forecast"
AIR_API_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"
OUTPUT_FILE = Path(__file__).resolve().parent / "weather_data.json"

# These are suburb coordinates, not weather stations.
SUBURBS = {
    "Melbourne CBD": (-37.8136, 144.9631),
    "Melton": (-37.6834, 144.5833),
    "Werribee": (-37.9000, 144.6600),
    "Craigieburn": (-37.5980, 144.9410),
    "Belgrave": (-37.9100, 145.3530),
    "Frankston": (-38.1440, 145.1220),
}

# fixed crash on "none" > Now prints n/a
def show(value, digits=1):
    return "n/a" if value is None else f"{value:.{digits}f}"

def get_weather():
    """Get current weather for all six suburbs."""
    params = {
        "latitude": ",".join(str(lat) for lat, _ in SUBURBS.values()),
        "longitude": ",".join(str(lon) for _, lon in SUBURBS.values()),
        "current": "temperature_2m,apparent_temperature,relative_humidity_2m",
        "temperature_unit": "celsius",
        "timezone": "GMT",
    }
    url = API_URL + "?" + urlencode(params)
    with urlopen(url, timeout=15) as response:
        return json.load(response)


def validate_weather(payload):
    """Check the API response and prepare it for the dashboard."""
    if not isinstance(payload, list) or len(payload) != len(SUBURBS):
        raise ValueError("API did not return all six locations")

    rows = []
    for (name, (lat, lon)), item in zip(SUBURBS.items(), payload):
        if not isinstance(item, dict):
            raise ValueError(f"{name}: invalid API response")
        current = item.get("current")
        units = item.get("current_units")
        if not isinstance(current, dict):
            current = {}
        if not isinstance(units, dict):
            units = {}

        # For each field: expected unit, lowest and highest believable value.
        # Missing, non-numeric, out-of-range or wrong-unit values are saved as None (null).
        expected = {
            "temperature_2m": ("°C", -50, 60),
            "apparent_temperature": ("°C", -80, 80),
            "relative_humidity_2m": ("%", 0, 100),
        }
        cleaned = {}
        for field, (unit, lower, upper) in expected.items():
            value = current.get(field)
            ok = (type(value) in (int, float) and math.isfinite(value)
                  and lower <= value <= upper and units.get(field) == unit)
            cleaned[field] = value if ok else None
            if not ok:
                print(f"Warning: {name}: {field} missing or invalid, saved as null")

        for coordinate, lower, upper in (("latitude", -90, 90), ("longitude", -180, 180)):
            value = item.get(coordinate)
            if type(value) not in (int, float) or not math.isfinite(value) or not lower <= value <= upper:
                raise ValueError(f"{name}: invalid model {coordinate}")

        observed_at = current.get("time")
        try:
            datetime.fromisoformat(observed_at)
        except (TypeError, ValueError):
            observed_at = None

        rows.append({
            "suburb": name,
            "requested_latitude": lat,
            "requested_longitude": lon,
            "model_latitude": item.get("latitude"),
            "model_longitude": item.get("longitude"),
            "temperature_c": cleaned["temperature_2m"],
            "feels_like_c": cleaned["apparent_temperature"],
            "humidity_pct": cleaned["relative_humidity_2m"],
            "observed_at_gmt": observed_at,
            "source": "Open-Meteo Forecast API",
            "data_type": "model_estimate",
        })
    return rows


def get_environment():
    """Get UV and PM2.5 from the air-quality API."""
    params = {
        "latitude": ",".join(str(lat) for lat, _ in SUBURBS.values()),
        "longitude": ",".join(str(lon) for _, lon in SUBURBS.values()),
        "current": "uv_index,pm2_5",
        "timezone": "GMT",
    }
    with urlopen(AIR_API_URL + "?" + urlencode(params), timeout=15) as response:
        return json.load(response)


def validate_environment(payload):
    """Check the air-quality values for each suburb."""
    if not isinstance(payload, list) or len(payload) != len(SUBURBS):
        raise ValueError("Air-quality response does not match the location count")
    result = []
    for item in payload:
        if not isinstance(item, dict) or not isinstance(item.get("current"), dict):
            raise ValueError("Invalid air-quality location")
        current = item["current"]
        units = item.get("current_units")
        if not isinstance(units, dict):
            raise ValueError("Missing air-quality units")
        # UV is an index. PM2.5 is measured in micrograms per cubic metre.
        # The API can use different symbols for the same units.
        uv_unit = str(units.get("uv_index", "")).strip().lower()
        pm_unit = str(units.get("pm2_5", "")).strip().replace("µ", "μ").replace("³", "3")
        if uv_unit not in ("", "index", "uv index"):
            raise ValueError(f"Unexpected UV unit: {uv_unit}")
        if pm_unit not in ("μg/m3", "ug/m3"):
            raise ValueError(f"Unexpected PM2.5 unit: {pm_unit}")
        values = {}
        for field, key in (("uv_index", "uv_index"), ("pm2_5", "pm25_ug_m3")):
            value = current.get(field)
            if value is None:
                values[key] = None
            elif type(value) in (int, float) and math.isfinite(value) and value >= 0:
                values[key] = value
            else:
                raise ValueError(f"Invalid air-quality value: {field}")
        values["environment_observed_at_gmt"] = current.get("time")
        result.append(values)
    return result

def main():
    try:
        rows = validate_weather(get_weather())
    except (HTTPError, URLError, TimeoutError, OSError, ValueError) as exc:
        print(f"Validation failed: {exc}")
        return 1

    # Keep the weather data even if the air-quality request fails.
    try:
        environment = validate_environment(get_environment())
    except (HTTPError, URLError, TimeoutError, OSError, ValueError, TypeError) as exc:
        print(f"Air-quality data unavailable: {exc}")
        environment = [{"uv_index": None, "pm25_ug_m3": None, "environment_observed_at_gmt": None}
                       for _ in rows]
    for row, readings in zip(rows, environment):
        row.update(readings)

    OUTPUT_FILE.write_text(json.dumps({
        "retrieved_at_utc": datetime.now(timezone.utc).isoformat(),
        "locations": rows,
    }, indent=2) + "\n", encoding="utf-8")
    print(f"{'Suburb':<16} {'Temp °C':>8} {'Feels °C':>9} {'Humidity':>9}")
    for row in rows:
        print(f"{row['suburb']:<16} {show(row['temperature_c']):>8} {show(row['feels_like_c']):>9} {show(row['humidity_pct'], 0):>8}%")
    available_uv = sum(r["uv_index"] is not None for r in rows)
    available_pm = sum(r["pm25_ug_m3"] is not None for r in rows)
    print(f"Environmental fields available: UV {available_uv}/{len(rows)}, PM2.5 {available_pm}/{len(rows)}")
    usable = sum(r["temperature_c"] is not None for r in rows)
    print(f"\n{usable}/6 locations have a valid temperature. Saved to {OUTPUT_FILE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
