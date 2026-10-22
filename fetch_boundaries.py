#!/usr/bin/env python3
"""Download the six suburb boundary shapes for the map."""

import json
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

# Use the Vicmap FeatureServer because the earlier map endpoint did not work.
API = (
    "https://services-ap1.arcgis.com/P744lA0wf4LlBZ84/ArcGIS/rest/"
    "services/Vicmap_Admin/FeatureServer/11/query"
)
SUBURBS = ["MELBOURNE", "MELTON", "WERRIBEE", "CRAIGIEBURN", "BELGRAVE", "FRANKSTON"]
OUTPUT = Path(__file__).resolve().parent / "static" / "suburb_boundaries.geojson"


def download_boundaries():
    names = ",".join(f"'{name}'" for name in SUBURBS)
    params = {
        "where": f"locality_name IN ({names})",
        "outFields": "locality_name",
        "returnGeometry": "true",
        "outSR": "4326",  # GeoJSON uses longitude/latitude
        "f": "geojson",
        "geometryPrecision": "5",
        "maxAllowableOffset": "0.00005",
    }
    url = API + "?" + urlencode(params)
    request = Request(url, headers={"User-Agent": "UrbanHeat-AU-CST190/1.0"})
    with urlopen(request, timeout=45) as response:
        data = json.load(response)

    if "error" in data:
        raise ValueError(f"Vicmap API error: {data['error']}")
    if data.get("type") != "FeatureCollection":
        raise ValueError("Expected a GeoJSON FeatureCollection")

    features = data.get("features", [])
    found = {
        str(feature.get("properties", {}).get("locality_name", "")).upper()
        for feature in features
    }
    missing = set(SUBURBS) - found
    if missing:
        raise ValueError(f"Missing localities: {sorted(missing)}; received {sorted(found)}")
    if any(
        feature.get("geometry", {}).get("type") not in ("Polygon", "MultiPolygon")
        for feature in features
    ):
        raise ValueError("Non-polygon geometry received")

    # Only save the file when all six suburbs are included.
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    temporary = OUTPUT.with_suffix(".tmp")
    temporary.write_text(json.dumps(data, separators=(",", ":")), encoding="utf-8")
    temporary.replace(OUTPUT)
    print(f"Saved {len(features)} locality polygons to {OUTPUT}")
    print("Locations:", ", ".join(sorted(found)))


if __name__ == "__main__":
    try:
        download_boundaries()
    except (HTTPError, URLError, TimeoutError, ValueError, OSError) as exc:
        raise SystemExit(f"Boundary download failed: {exc}")
