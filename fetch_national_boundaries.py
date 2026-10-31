"""Download the Australian state boundary layer for the national map.

Run: python3 fetch_national_boundaries.py
Source: geoBoundaries gbOpen AUS ADM1; uses its published download URL.
"""
import json
from pathlib import Path
from urllib.request import urlopen

METADATA = "https://www.geoboundaries.org/api/current/gbOpen/AUS/ADM1/"
OUTPUT = Path("static/australia_states.geojson")

def fetch(opener=urlopen, output=OUTPUT):
    with opener(METADATA, timeout=30) as response:
        info = json.load(response)
    url = info.get("simplifiedGeometryGeoJSON") or info.get("gjDownloadURL")
    if not isinstance(url, str) or not url.startswith("https://"):
        raise ValueError("No HTTPS boundary download in geoBoundaries metadata")
    with opener(url, timeout=180) as response:
        geography = json.load(response)
    if (geography.get("type") != "FeatureCollection"
            or not isinstance(geography.get("features"), list)
            or len(geography["features"]) < 8
            or not all(f.get("geometry", {}).get("type") in ("Polygon", "MultiPolygon")
                       for f in geography["features"])):
        raise ValueError("Unexpected state boundary data")
    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    from historical_weather import save_atomic
    save_atomic(output, geography)
    print(f'Saved {len(geography["features"])} boundary features to {output}')
    print("Source: geoBoundaries gbOpen, Australia ADM1; see source metadata for attribution.")
    return len(geography["features"])

if __name__ == "__main__":
    fetch()
