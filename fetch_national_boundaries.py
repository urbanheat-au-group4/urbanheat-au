"""Download authentic Australian state and territory outlines.

Source: geoBoundaries gbOpen Australia ADM1 (CC BY 4.0).
Try its GitHub release first, then fall back to the metadata API.
"""
import json
from pathlib import Path
from urllib.request import urlopen

# The released file is stored using Git LFS and served by GitHub's CDN.
RELEASE = (
    "https://github.com/wmgeolab/geoBoundaries/raw/refs/heads/main/"
    "releaseData/gbOpen/AUS/ADM1/geoBoundaries-AUS-ADM1_simplified.geojson"
)
METADATA = "https://www.geoboundaries.org/api/current/gbOpen/AUS/ADM1/"
OUTPUT = Path("static/australia_states.geojson")

STATES = {
    "New South Wales", "Victoria", "Queensland", "Western Australia",
    "South Australia", "Tasmania", "Northern Territory",
    "Australian Capital Territory",
}


def validate(data):
    """Reject broken, incomplete or incorrectly named boundary data."""
    if data.get("type") != "FeatureCollection":
        raise ValueError("Expected a GeoJSON FeatureCollection")
    features = data.get("features")
    if not isinstance(features, list):
        raise ValueError("Missing boundary features")
    names = set()
    for feature in features:
        geometry = feature.get("geometry") or {}
        if geometry.get("type") not in ("Polygon", "MultiPolygon"):
            raise ValueError("Non-polygon boundary received")
        name = str((feature.get("properties") or {}).get("shapeName", "")).strip()
        names.add(name)
    if not STATES.issubset(names):
        raise ValueError("Missing state boundaries: " + ", ".join(sorted(STATES - names)))
    return len(features)


def fetch(opener=urlopen, output=OUTPUT):
    """Fetch the original file without drawing substitute geography."""
    errors = []
    for source in (RELEASE, METADATA):
        try:
            if source == RELEASE:
                url = source
            else:
                with opener(METADATA, timeout=30) as response:
                    info = json.load(response)
                url = info.get("simplifiedGeometryGeoJSON") or info.get("gjDownloadURL")
                if not isinstance(url, str) or not url.startswith("https://"):
                    raise ValueError("Metadata has no valid download URL")
            with opener(url, timeout=90) as response:
                data = json.load(response)
            count = validate(data)
            from historical_weather import save_atomic
            output = Path(output)
            output.parent.mkdir(parents=True, exist_ok=True)
            save_atomic(output, data)
            print(f"Saved {count} authentic state boundary features to {output}")
            print("Source: geoBoundaries gbOpen AUS ADM1 (CC BY 4.0)")
            return count
        except (OSError, ValueError, TypeError, KeyError) as exc:
            errors.append(str(exc))
    raise RuntimeError("Could not download national boundaries: " + " / ".join(errors))


if __name__ == "__main__":
    fetch()
