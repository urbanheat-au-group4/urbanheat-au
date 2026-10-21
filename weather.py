"""Fetch and validate current modelled weather for six Melbourne locations."""

import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import urlopen

API_URL = "https://api.open-meteo.com/v1/forecast"
OUTPUT_FILE = Path(__file__).resolve().parent / "weather_data.json"

# Representative suburb centres, not weather sensor locations.
SUBURBS = {
    "Melbourne CBD": (-37.8136, 144.9631),
    "Fitzroy": (-37.7984, 144.9782),
    "Footscray": (-37.8000, 144.9000),
    "St Kilda": (-37.8676, 144.9809),
    "Chadstone": (-37.8863, 145.0822),
    "Dandenong": (-37.9875, 145.2148),
}


def get_weather():
    """Request current weather for the six suburbs in one API call."""
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
    """Convert the Open-Meteo response into records our dashboard understands."""
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
            if type(value) not in (int, float):
                raise ValueError(f"{name}: missing or invalid {field}")
            if units.get(field) != unit:
                raise ValueError(f"{name}: unexpected unit for {field}")
        if not 0 <= current["relative_humidity_2m"] <= 100:
            raise ValueError(f"{name}: humidity outside 0-100%")
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


def main():
    try:
        rows = validate_weather(get_weather())
    except (HTTPError, URLError, TimeoutError, OSError, ValueError) as exc:
        print(f"Validation failed: {exc}")
        return 1

    OUTPUT_FILE.write_text(json.dumps({
        "retrieved_at_utc": datetime.now(timezone.utc).isoformat(),
        "locations": rows,
    }, indent=2) + "\n", encoding="utf-8")
    print(f"{'Suburb':<16} {'Temp °C':>8} {'Feels °C':>9} {'Humidity':>9}")
    for row in rows:
        print(f"{row['suburb']:<16} {row['temperature_c']:>8.1f} {row['feels_like_c']:>9.1f} {row['humidity_pct']:>8.0f}%")
    print(f"\nValidated {len(rows)}/6 locations. Saved to {OUTPUT_FILE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
