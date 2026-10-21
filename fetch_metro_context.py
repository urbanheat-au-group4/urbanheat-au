#!/usr/bin/env python3
"""Fetch simplified Melbourne locality outlines for a map background.

Does not replace the six highlighted suburb polygons downloaded separately.
"""
import json
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

API = ('https://services-ap1.arcgis.com/P744lA0wf4LlBZ84/ArcGIS/rest/'
       'services/Vicmap_Admin/FeatureServer/11/query')
OUTPUT = Path(__file__).resolve().parent / 'static' / 'metro_context.geojson'
# Approximate study-area envelope, not an official Greater Melbourne border.
BBOX = (144.78, -38.06, 145.30, -37.70)


def download():
    features = []
    for offset in range(0, 5000, 500):
        params = {
            'where': '1=1', 'geometry': ','.join(map(str, BBOX)),
            'geometryType': 'esriGeometryEnvelope', 'inSR': 4326,
            'spatialRel': 'esriSpatialRelIntersects', 'outFields': 'locality_name',
            'returnGeometry': 'true', 'outSR': 4326, 'f': 'geojson',
            'geometryPrecision': 4, 'maxAllowableOffset': 0.0006,
            'resultOffset': offset, 'resultRecordCount': 500,
            'orderByFields': 'objectid ASC',
        }
        request = Request(API + '?' + urlencode(params),
                          headers={'User-Agent': 'UrbanHeat-AU-CST190/1.0', 'Accept': 'application/json'})
        with urlopen(request, timeout=60) as response:
            data = json.load(response)
        if 'error' in data:
            raise ValueError(f"Vicmap returned: {data['error']}")
        if data.get('type') != 'FeatureCollection':
            raise ValueError('Vicmap did not return GeoJSON')
        page = data.get('features', [])
        if not isinstance(page, list):
            raise ValueError('Invalid feature list')
        features.extend(f for f in page if f.get('geometry', {}).get('type') in ('Polygon', 'MultiPolygon'))
        if len(page) < 500:
            break
    else:
        raise ValueError('Pagination limit reached')
    if not features:
        raise ValueError('No locality boundaries found')
    payload = {'type': 'FeatureCollection', 'features': features}
    OUTPUT.parent.mkdir(exist_ok=True)
    temporary = OUTPUT.with_suffix('.tmp')
    temporary.write_text(json.dumps(payload, separators=(',', ':')), encoding='utf-8')
    temporary.replace(OUTPUT)
    print(f'Saved {len(features)} surrounding locality outlines to {OUTPUT}')

if __name__ == '__main__':
    try:
        download()
    except (OSError, ValueError, TimeoutError) as exc:
        raise SystemExit(f'Background boundary download failed: {exc}')
