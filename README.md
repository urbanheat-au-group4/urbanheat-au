# UrbanHeat AU

CST190 project: an Australia-wide historical climate explorer for **112 locations** across all eight Australian states and territories. The homepage is the national SVG map. Selecting a state zooms in to its 14 locations; selecting a marker shows the modelled climate statistics.

## Run locally

Use Python 3. The dashboard reads saved historical weather data.

### First time setup

If `data/national/locations/` is empty, download the historical files first:

```bash
python3 national_ingest.py --group australia_historical --out data/national
```

The downloader saves up to five new locations per run. **Run it again** until all 112 are saved. It reuses the valid files you already have. Internet access is needed for the downloads.

### Start the app

```bash
python3 run.py
```

Open **http://localhost:8000/**.

`run.py` checks the saved readings, makes the map and chart JSON files, checks the state boundaries and starts `server.py`. It downloads state boundaries if they are missing or broken. It **does not** download historical weather again every time the app starts.

To prepare and check the files without starting the server:

```bash
python3 run.py --check
```

If data is missing or incorrect, the command stops and tells you what to check. The server will not start with incomplete national data.

You can still use `python3 server.py` to open the website using already prepared files. It does not check or rebuild those files.

The **Back to Australia** button returns from any state or territory to the national view. Use the state selector or click a state outline to zoom in. State and location filters, labels, and the selected climate measurement all update together.

The map data is generated locally in `static/national_data.json`. If a location fails coverage checks it is excluded rather than assigned a fictional measurement. Regenerate the export when validated historical files change. The Historical Trends and Seasonal Climate Comparison sections read `static/national_history.json` and `static/national_seasons.json`, so run `history_export.py` and `seasonal_export.py` again whenever the downloaded data changes. The state boundary download needs internet access.

## Test

```bash
python3 -m unittest discover -s tests -p 'test_*.py' -v
```

Most tests are offline. Node.js is used for the JavaScript layout tests when available.

### Browser acceptance checks

GitHub CI runs the eight-state Chromium test, including desktop and mobile screenshots, and uploads them as the `national-map-browser-evidence` artifact. The CI test takes location names and coordinates from the real catalogue, but sets weather measurements to unavailable. It never invents temperatures.

To check your **actual downloaded climate values** locally:

```bash
python3 national_export.py --data-dir data/national
python3 fetch_national_boundaries.py
npm install
npx playwright install chromium
python3 server.py
```

In another terminal run `npm run test:browser`. The screenshots are saved under `artifacts/national-map/`. Check the screenshots visually as well: automated tests alone cannot certify that every label is comfortably readable.

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

The previous six-suburb Greater Melbourne map is no longer part of the public site. Its source files and current-weather importer remain in the repository for regression tests. The national homepage does not load them.

The old Melbourne map uses the Victorian Government's **Vicmap Admin – Locality Polygon Aligned to Property (LOCALITY_POLYGON)** data. The download scripts use layer 11 of the Vicmap Admin FeatureServer. DataVic lists this dataset under **Creative Commons Attribution 4.0**. I have kept this source separate from the national map because the national state boundaries come from geoBoundaries, not Vicmap.

- [Vicmap locality dataset and licence](https://discover.data.vic.gov.au/dataset/vicmap-admin-locality-polygon-aligned-to-property)
- [Vicmap Admin source](https://www.land.vic.gov.au/maps-and-spatial/spatial-data/vicmap-catalogue/vicmap-admin)
- [CC BY 4.0 terms](https://creativecommons.org/licenses/by/4.0/)

The old Melbourne shapes are adapted for display. They show locality boundaries only, not temperature readings across whole suburbs.

The server no longer starts live forecast refreshes by default. For legacy testing only, set `URBANHEAT_LEGACY_REFRESH=1` before starting `server.py`.

The Historical Trends chart (UHA-61) and Seasonal Climate Comparison (UHA-62) are part of the national page, below the map.

Project tracking: Jira. Code and tests: GitHub. Sprint reports: Confluence.
