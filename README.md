# UrbanHeat AU

CST190 project: an Australia-wide historical climate explorer for **112 locations** across all eight Australian states and territories. The homepage is the national SVG map. Selecting a state zooms in to its 14 locations; selecting a marker shows the modelled climate statistics.

## Run locally

Requires Python 3 and a browser. No extra Python packages.

The validated historical snapshots must already be available under `data/national/locations/`. From the project root:

```bash
python3 national_coverage.py --data-dir data/national
python3 national_export.py --data-dir data/national
python3 fetch_national_boundaries.py
python3 server.py
```

Open **http://localhost:8000/**. The same map can be opened at `/static/national.html`.

The **Back to Australia** button returns from any state or territory to the national view. Use the state selector or click a state outline to zoom in. State and location filters, labels, and the selected climate measurement all update together.

The map data is generated locally in `static/national_data.json`. If a location fails coverage checks it is excluded rather than assigned a fictional measurement. Regenerate the export when validated historical files change. The state boundary download needs internet access.

## Test

```bash
python3 -m unittest discover -s tests -p 'test_*.py' -v
```

Most tests are offline. Node.js is used for the JavaScript layout tests when available. Automated checks do not replace browser checks for desktop and mobile layouts.

## Data and limitations

```text
Open-Meteo historical weather (2015–2025)
        ↓
data/national/locations/*.json
        ↓
national_coverage.py → national_climate.py → national_export.py
                                                ↓
                         static/national_data.json
                                                ↓
geoBoundaries state outlines → static/national.js → National homepage
```

- Temperatures and rainfall are **historical model estimates**, not live weather observations or sensor measurements.
- State shading is an average of **14 selected places**, not a measured or calculated average over the entire state.
- Selectable markers represent individual locations; incomplete records are excluded.
- Location coordinates still need independent geocoding verification.
- Boundaries are downloaded using `fetch_national_boundaries.py` from geoBoundaries gbOpen.

## Previous Melbourne dashboard

The previous six-suburb Greater Melbourne map is no longer part of the public site. Its source files and current-weather importer remain in the repository for regression tests and Dale's unfinished historical-chart work. The national homepage does not load them.

The server no longer starts live forecast refreshes by default. For legacy testing only, set `URBANHEAT_LEGACY_REFRESH=1` before starting `server.py`.

Historical chart work can be added to the single national experience once ready.

Project tracking: Jira. Code and tests: GitHub. Sprint reports: Confluence.
