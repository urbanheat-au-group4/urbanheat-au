# UrbanHeat AU

CST190 project: an interactive Australia-wide historical climate map comparing **112 locations**, with all eight states and territories available as zoomable views. The original six-suburb Melbourne map is retired from the public navigation. Historical chart work can be integrated into this national view when ready.

## Running locally

Requires Python 3 and a modern browser. No third-party Python packages.

From the repository root, after the validated national historical data has been downloaded to `data/national`:

```bash
python3 national_export.py --data-dir data/national
python3 fetch_national_boundaries.py
python3 server.py
```

Open **http://localhost:8000/**. The homepage now loads the national map directly; `/static/national.html` remains a direct link to the same view. For static hosting, `/static/index.html` redirects to the national page.

On the map, select a state or territory to focus its 14 locations, then select a marker to see its historical statistics. Use **Back to Australia** to return to the full map. State colours summarise the sampled places, **not** every square kilometre of a state.

The former Melbourne dashboard JavaScript and source datasets are kept in the repository for tests and ongoing historical-chart work, but are no longer loaded by the homepage. They can be retired after the remaining coursework is integrated and verified.

## Tests

```zsh
python3 -m unittest discover -s tests -p 'test_*.py' -v
```

Tests use offline fixtures. They check data validation rather than full browser usability.

## Data flow

```text
Open-Meteo Forecast ───┐
                       ├── weather.py → weather_data.json ──┐
Open-Meteo Air Quality ┘                                     │
Vicmap boundaries → local GeoJSON ────────────────────────────┤
                                                              ▼
                                             server.py → static/app.js → SVG map/cards
```

## Interpretation

- Air and apparent temperatures are **forecast model estimates** at requested coordinates, not local sensor readings.
- UV and PM2.5 come from the [Open-Meteo Air Quality API](https://open-meteo.com/en/docs/air-quality-api), using gridded model data. Nearby suburbs may legitimately have very similar readings.
- PM2.5 is expressed in µg/m³. It is **not an AQI rating**.
- The map colours encode **relative air temperature only**, not UV, PM2.5 or heat exposure across entire polygons.
- User-set heat thresholds are demonstrations, **not** official BoM heatwave alerts.
- Geographic outlines come from [Vicmap](https://www.land.vic.gov.au/maps-and-spatial/spatial-data/vicmap); weather from [Open-Meteo](https://open-meteo.com/).
- All updated weather values are saved locally. The server refreshes weather data at startup. Restart the server or run `python3 weather.py` to update it later.

Issue tracking: Jira. Source and tests: GitHub. Sprint assessment: Confluence.


## Historical weather (Sprint 3)

Run `python3 historical_weather.py` to download daily ERA5 reanalysis data from Open-Meteo for 2015–2025. The importer uses `locations.json` when the expanded catalogue is available; until then, it uses the six locations in `weather.py`. Output is saved locally as `historical_weather.json`, and is not committed to GitHub.

The importer checks day order, date coverage, units, numeric readings and coordinates. Missing values stay `null`; failed requests do not replace earlier saved data. It retries failed requests at most three times. The historical data is a model estimate, not a weather station measurement. Run offline checks with `python3 -m unittest discover -s tests -p 'test_*.py' -v`.
