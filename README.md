# UrbanHeat AU

CST190 project: an Australia-wide historical climate explorer for **112 locations** across all eight Australian states and territories. The homepage is the national SVG map. Selecting a state zooms in to its 14 locations; selecting a marker shows the modelled climate statistics.

## Live dashboard

Open [UrbanHeat AU on GitHub Pages](https://urbanheat-au-group4.github.io/urbanheat-au/). The map shows all 112 locations. The coverage line shows how many have validated historical readings. Updates to `main` rebuild and deploy the site. See [hosting setup](DEPLOYMENT.md).

1. Start on **Overview**. Pick a place on the map or use **Find a location**.
2. Open **Historical** for monthly highs, annual trends and seasonal charts for that location.
3. Choose a **Comparison baseline** and open **Compare**. You can swap the two places or add a third. Your selections stay in place as you switch tabs.

## Run locally

Use Python 3. The dashboard reads saved historical weather data.

### First time setup

If `data/national/locations/` is empty, download the historical files first:

```bash
python3 national_ingest.py --group australia_historical --out data/national
```

The downloader saves up to five new locations per run. **Run it again** until all 112 are saved. It reuses the valid files you already have. Internet access is needed for the downloads.

### Faster, resumable national batches (UHA-107)

The optional national batch importer makes **small requests** rather than asking for all 112 locations at once:

```bash
python3 national_batch.py --out data/national
```

It requests **two locations at a time**, with an eight-second pause between requests by default. It checks saved files and skips locations that already have valid historical data. If an API request is rate-limited (HTTP 429) or too large (HTTP 400), it stops further requests and keeps all successful files.

The summary is saved to `data/national/batch_result.json`. Check its `completed`, `missing`, `failed`, and `reason` fields after each run. If incomplete, resume **later** with the same command; do not repeatedly retry a rate limit. You may use `--batch-size 1` for smaller requests, or `--delay 15` to space them further apart. A successful script run is not independent verification of the historical readings or coordinates.

### Final offline release audit (Sprint 4)

After the full historical snapshots are present, run:

```bash
python3 run.py --check
python3 verify_national_release.py
```

The second command does **not** contact Open-Meteo or modify your weather exports. It checks that the independent daily coverage audit and all three generated dashboard JSON files agree about the location IDs, 2015–2025 period and ERA5 model. It also checks that the map has a 12-month chart series and the history/seasonal exports have the expected rows.

The results are saved to `artifacts/uha-46-export-audit.json`. Attach that file and the command output to UHA-46, UHA-44 and UHA-82. A PASS verifies **local data consistency only**. It does not establish that the coordinates are independently correct, that Open-Meteo's original measurements are accurate, or that the UI passes manual accessibility tests.

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

### After pulling new heat-feature code

If the new heat figures do not appear, your existing `static/national_data.json` may be from an older export. Stop the website and run:

```bash
git pull
python3 run.py
```

`run.py` rebuilds the saved map and chart data from your historical files, then starts the website. Choose a heat measure in **Map measure** and select a location. Open **Historical** for the monthly daytime highs chart. If historical files are missing or incomplete, `run.py` explains which data is missing.

## Hot weather and monthly daytime highs

Select a location on the national map to see its hottest modelled day (with the date), and the average temperature of its hottest 10%, 25% and 50% of days.

The **Monthly daytime highs** chart shows January to December. Each point averages the daily maximum temperatures for that month across 2015–2025.

The hottest-day groups sort all valid daily maximum temperatures from hottest to coolest. For example, the hottest 10% averages the hottest tenth of days; this is different from the temperature cutoff for the 90th percentile. These modelled estimates are not official temperature records.

The **Back to Australia** button returns from any state or territory to the national view. Use the state selector or click a state outline to zoom in. State and location filters, labels, and the selected climate measurement all update together.

The map data is generated locally in `static/national_data.json`. If a location fails coverage checks it is excluded rather than assigned a fictional measurement. Regenerate the export when validated historical files change. The Historical Trends and Seasonal Climate Comparison sections read `static/national_history.json` and `static/national_seasons.json`, so run `history_export.py` and `seasonal_export.py` again whenever the downloaded data changes. The state boundary download needs internet access.

## Test

```bash
python3 -m unittest discover -s tests -p 'test_*.py' -v
```

Most tests are offline. Node.js is used for the JavaScript layout tests when available.

### Browser acceptance checks

GitHub CI runs the eight-state Chromium test, including desktop and mobile screenshots, and uploads them as the `national-map-browser-evidence` artifact. The CI test takes location names and coordinates from the real catalogue, but sets weather measurements to unavailable. It never invents temperatures.

### Two different checks: real climate data and browser behaviour

**To check real downloaded weather:** first download and validate the historical snapshots, then run:

```bash
python3 run.py --check
```

This checks the saved location snapshots and builds the three JSON exports. It **does not** prove that the coordinates match each real suburb or that Open-Meteo itself is correct. The exports contain modelled readings only if the saved snapshots passed validation. Check the coverage results before using the figures in a presentation.

**To check the website without historical downloads:** start from a fresh clone with no `static/national_data.json`, then run:

```bash
python3 tests/prepare_national_browser_data.py
python3 fetch_national_boundaries.py
npm install
npx playwright install chromium
python3 server.py
```

In a second terminal run:

```bash
npm run test:browser
npm run test:regression
npm run test:cross-state
npm run test:charts
```

These browser tests use the real catalogue and boundaries but **do not supply real weather measurements**. The test-only export intentionally contains missing readings. Some regression cases use clearly labelled made-up numbers only inside the test, never in real data. Do not use these fixture screenshots as evidence of actual historical temperatures.

The `prepare_national_browser_data.py` script refuses to overwrite an existing `static/national_data.json`. Use a clean test clone instead of deleting your real exported data just to run the UI tests. Browser screenshots are saved under `artifacts/national-map/` and should be inspected visually.

### Common setup problems

- **Missing historical snapshots:** `run.py` explains which location files are missing. Download the raw daily snapshots separately. The repository includes the summary files used on GitHub Pages.
- **HTTP 400 or 429 from Open-Meteo:** stop rather than retrying rapidly. Jira UHA-107 tracks the large national-batch request; do not assume all 112 files were downloaded.
- **No state outlines:** `fetch_national_boundaries.py` needs a network connection to obtain geoBoundaries data.
- **Old or missing heat figures:** stop the server and run `python3 run.py` to rebuild the browser exports from the validated snapshots.
- **Port 8000 is already used:** stop the previous instance of `server.py` before starting another one.

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

The **Historical** tab includes Historical Trends (UHA-61), Seasonal Climate Comparison (UHA-62) and data tables for the selected location.

Project tracking: Jira. Code and tests: GitHub. Sprint reports: Confluence.

## Compare Locations (UHA-63)

The **Compare** tab shows the selected location and baseline side by side. Use the controls above the tabs to change either selection.

**What it shows**

- Typical summer maximum and winter minimum temperature
- Hot days per year (35 °C or more)
- Average annual rainfall, plus typical summer and winter rainfall
- The difference from the selected baseline, where the data supports one

**How it works**

- It combines `static/national_data.json` (yearly figures) and `static/national_seasons.json` (seasonal figures). Build them with `national_export.py` and `seasonal_export.py` as described above.
- Every location uses the same period (2015-01-01 to 2025-12-31), the same units and the same model (Open-Meteo, ERA5).
- The calculations are in `static/compare_core.js`. The page code is in `static/compare.js`.
- Run the tests with `node --test tests/test_compare.cjs`.

**Limitations**

- Values are modelled estimates, not weather station readings.
- The ERA5 model works on a grid of about 25 km. Locations less than 25 km apart cannot be reliably told apart, so the page warns about them and does not show differences between them or rank them.
- A seasonal figure only counts years that have a value for every day. If locations are based on a different number of years, the page says so.
- This compares modelled climate only. It does not say that one place is better to live in, because that depends on things the data does not cover.
