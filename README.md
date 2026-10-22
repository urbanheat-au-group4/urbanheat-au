# UrbanHeat AU

CST190 software project: a dashboard comparing **modelled weather and environmental conditions** across six geographically dispersed Greater Melbourne locations: Melbourne CBD, Melton, Werribee, Craigieburn, Belgrave and Frankston.

## Running locally

Requires Python 3, internet for downloading updated API data, and a modern browser. No third-party Python packages.

From the repository root:

```zsh
python3 fetch_boundaries.py
python3 fetch_metro_context.py
python3 weather.py
python3 server.py
```

Open http://localhost:8000. The first two scripts rebuild local GeoJSON for the revised map. Run them after changing the monitored locations. `weather.py` creates `weather_data.json`, including optional UV and PM2.5 from Open-Meteo's separate Air Quality API. If air quality is unavailable, temperature readings remain usable and the air-quality fields show as unavailable. `server.py` serves the files locally.

The browser's **Reload saved data** button reloads the JSON; to obtain fresh observations first rerun `python3 weather.py` in another terminal.

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
- All updated weather values are saved locally. The site does not automatically refresh API data.

Issue tracking: Jira. Source and tests: GitHub. Sprint assessment: Confluence.
