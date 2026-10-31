#!/usr/bin/env python3
"""Get nearby suburb outlines for the map background.

Does not replace the six highlighted suburb polygons downloaded separately.
"""
import json
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

API = ('https://services-ap1.arcgis.com/P744lA0wf4LlBZ84/ArcGIS/rest/'
       'services/Vicmap_Admin/FeatureServer/11/query')
OUTPUT = Path(__file__).resolve().parent / 'static' / 'metro_context.geojson'
# This rectangle is just the area we want to show, not Melbourne's actual boundary.
BBOX = (144.45, -38.30, 145.55, -37.45)


def download():
    # Fetch smaller map tiles so the service cannot silently return only
    # the first portion of the Melbourne area.
    features = {}
    west, south, east, north = BBOX
    columns, rows = 4, 4
    for row in range(rows):
        for column in range(columns):
            x1 = west + (east - west) * column / columns
            x2 = west + (east - west) * (column + 1) / columns
            y1 = south + (north - south) * row / rows
            y2 = south + (north - south) * (row + 1) / rows
            params = {
                'where': '1=1', 'geometry': ','.join(map(str, (x1, y1, x2, y2))),
                'geometryType': 'esriGeometryEnvelope', 'inSR': 4326,
                'spatialRel': 'esriSpatialRelIntersects',
                'outFields': 'locality_name', 'returnGeometry': 'true',
                'outSR': 4326, 'f': 'geojson',
                'geometryPrecision': 4, 'maxAllowableOffset': 0.0006,
                'resultRecordCount': 1000,
            }
            request = Request(API + '?' + urlencode(params),
                              headers={'User-Agent': 'UrbanHeat-AU-CST190/1.0',
                                       'Accept': 'application/json'})
            with urlopen(request, timeout=60) as response:
                data = json.load(response)
            if 'error' in data or data.get('type') != 'FeatureCollection':
                raise ValueError('Vicmap returned invalid boundaries')
            page = data.get('features', [])
            if len(page) >= 1000 or data.get('exceededTransferLimit'):
                raise ValueError('Too many boundaries in one tile')
            for feature in page:
                if feature.get('geometry', {}).get('type') not in ('Polygon', 'MultiPolygon'):
                    continue
                # The same locality may appear in neighbouring tiles.
                key = feature.get('properties', {}).get('locality_name')
                if key:
                    features[key] = feature
    features = list(features.values())
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
