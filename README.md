# UrbanHeat AU

CST190 Software Development Fundamentals group project. UrbanHeat AU displays **modelled current weather estimates** for six Melbourne locations on a lightweight local dashboard and SVG locality map.

## Requirements

- Python 3 (tested for use with Ubuntu 24.04)
- Internet access to update weather and locality boundary files
- Modern web browser

The current Python implementation uses the standard library. No Python packages need to be installed.

## Run locally

From the repository root:

```bash
python3 weather.py
python3 server.py
```

Open http://localhost:8000 . Stop the server with `Ctrl+C`.

`weather.py` obtains the current Open-Meteo forecast and writes `weather_data.json`. The dashboard reads this saved file; **data does not refresh automatically**. Run `python3 weather.py` again and use the dashboard's Refresh control to load updated values.

If the saved geographic boundary files need rebuilding, run:

```bash
python3 fetch_boundaries.py
python3 fetch_metro_context.py
```

The geographic scripts need network access. Saved GeoJSON lets the map load locally without contacting Vicmap each time.

## Test

From the repository root:

```bash
python3 -m unittest discover -s tests -p 'test_*.py' -v
```

These offline tests validate the Python weather data contract and selected invalid-input cases. They are **not** a comprehensive browser, usability or accessibility test suite.

## Architecture

```text
Open-Meteo Forecast API → weather.py → weather_data.json
                                         ↓
                                   server.py
                                         ↓
                              static/index.html
                              static/app.js + CSS
                                         ↓
Vicmap GeoJSON files → interactive SVG locality map
```

- `weather.py`: fetches and validates weather values.
- `server.py`: serves the dashboard and its saved JSON files locally.
- `static/`: browser interface, SVG map and stored geographic data.
- `fetch_boundaries.py`, `fetch_metro_context.py`: prepare geographic data.
- `tests/`: offline weather validation tests.

## Data sources and limitations

- **Weather:** [Open-Meteo Forecast API](https://open-meteo.com/en/docs), using representative coordinates for Melbourne CBD, Fitzroy, Footscray, St Kilda, Chadstone and Dandenong.
- **Geographic boundaries:** Victorian [Vicmap](https://www.land.vic.gov.au/maps-and-spatial/spatial-data/vicmap) administrative locality boundaries; the downloader uses an ArcGIS FeatureServer.
- The temperature is a forecast-model estimate at a representative point, **not** a suburb-wide measurement, measured surface temperature or precise street-level reading.
- Threshold indicators are user-defined demonstrations, **not official emergency warnings**.
- Weather timestamps are reported in GMT/UTC by the ingestion code.
- Geographic data and saved weather values may become stale; run the ingestion scripts when updates are required.

## Development

Jira tracks work items and acceptance criteria; GitHub tracks source changes and tests; Confluence contains sprint reports and assessment evidence. Commit messages should reference their Jira issue key.
