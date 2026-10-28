"""Get weather data for the six Melbourne locations and check it is valid."""

import json
import math
import os
import tempfile
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
            raise ValueError(f"{name}: invalid location response")
        current = item.get("current")
        units = item.get("current_units")
        if not isinstance(current, dict) or not isinstance(units, dict):
            raise ValueError(f"{name}: missing weather data or units")
        expected_units = {
            "temperature_2m": "°C",
            "apparent_temperature": "°C",
            "relative_humidity_2m": "%",
        }
        for field, unit in expected_units.items():
            value = current.get(field)
            if type(value) not in (int, float) or not math.isfinite(value):
                raise ValueError(f"{name}: missing or invalid {field}")
            if units.get(field) != unit:
                raise ValueError(f"{name}: unexpected unit for {field}")
        if not 0 <= current["relative_humidity_2m"] <= 100:
            raise ValueError(f"{name}: humidity outside 0-100%")
        for coordinate, lower, upper in (("latitude", -90, 90), ("longitude", -180, 180)):
            value = item.get(coordinate)
            if type(value) not in (int, float) or not math.isfinite(value) or not lower <= value <= upper:
                raise ValueError(f"{name}: invalid model {coordinate}")
        observed_at = current.get("time")
        if not isinstance(observed_at, str):
            raise ValueError(f"{name}: missing timestamp")
        try:
            datetime.fromisoformat(observed_at)
        except ValueError as exc:
            raise ValueError(f"{name}: invalid timestamp") from exc

        rows.append({
            "suburb": name,
            "requested_latitude": lat,
            "requested_longitude": lon,
            "model_latitude": item.get("latitude"),
            "model_longitude": item.get("longitude"),
            "temperature_c": current["temperature_2m"],
            "feels_like_c": current["apparent_temperature"],
            "humidity_pct": current["relative_humidity_2m"],
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

    # Write a complete temporary file before replacing the saved data
    content = json.dumps({
        "retrieved_at_utc": datetime.now(timezone.utc).isoformat(),
        "locations": rows,
    }, indent=2) + "\n"
    temporary_path = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w", encoding="utf-8", dir=OUTPUT_FILE.parent,
            prefix=".weather-", suffix=".tmp", delete=False
        ) as handle:
            temporary_path = Path(handle.name)
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary_path, OUTPUT_FILE)
    except OSError as exc:
        print(f"Could not save weather data: {exc}")
        return 1
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)
    print(f"{'Suburb':<16} {'Temp °C':>8} {'Feels °C':>9} {'Humidity':>9}")
    for row in rows:
        print(f"{row['suburb']:<16} {row['temperature_c']:>8.1f} {row['feels_like_c']:>9.1f} {row['humidity_pct']:>8.0f}%")
    available_uv = sum(r["uv_index"] is not None for r in rows)
    available_pm = sum(r["pm25_ug_m3"] is not None for r in rows)
    print(f"Environmental fields available: UV {available_uv}/{len(rows)}, PM2.5 {available_pm}/{len(rows)}")
    print(f"\nValidated {len(rows)}/6 locations. Saved to {OUTPUT_FILE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
