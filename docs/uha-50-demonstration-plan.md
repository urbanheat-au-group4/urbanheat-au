# UHA-50 | Our final demonstration

**Rehearsed in Chromium on 26 November 2026** using the packaged Pages build from `93d34b9`.

Open the [live dashboard](https://urbanheat-au-group4.github.io/urbanheat-au/). Check that the heading shows 112 of 112 locations. The site uses Open-Meteo ERA5 modelled climate for 2015–2025.

| Time | What I do | What I explain |
| --- | --- | --- |
| 0:00–0:45 | Open Overview | UrbanHeat covers 112 selected locations in eight states and territories. |
| 0:45–1:30 | Select Tasmania, then Launceston | The state view shows 14 locations. Launceston’s annual mean is 13.4 °C. |
| 1:30–2:20 | Use Map measure to show the hottest modelled day and the hottest 10%, 25% and 50% | The hottest day was 35.4 °C on 31 January 2020. The group averages are 27.5, 25.2 and 22.5 °C. |
| 2:20–3:35 | Open Historical | Show the twelve monthly highs, annual temperature trends and four seasons. Open a data table to show exact values. |
| 3:35–4:35 | Choose Timber Creek as the baseline, open Compare and swap | The selected places carry across tabs. Differences use the same period. Places within about 25 km can share the same model grid. |
| 4:35–5:00 | Return to the source note and show the test evidence | State colours summarise our sampled locations. ERA5 figures are modelled estimates and missing data stays blank. |

## If Pages is unavailable

Serve the same packaged data locally. If the state-outlines file is absent, run the first command once.

```bash
python3 fetch_national_boundaries.py
python3 build_site.py --climate-dir data/pages-climate
python3 -m http.server 8000 --directory _site
```

Then open `http://localhost:8000/`. If the historical files are unavailable, show the map and explain the message in the chart. Use the recorded evidence for the weather figures.

## Rehearsal results

The rehearsal loaded the national map, selected Tasmania’s 14 locations, matched all five Launceston readings above against the exported values, opened the three charts and swapped the comparison pair. When the browser was made to receive HTTP 503 for the history file, the annual chart displayed a clear unavailable message. The release checks also captured desktop and mobile screenshots. Presenter order and the assessed presentation remain team activities.

[Browser results and screenshots](https://github.com/urbanheat-au-group4/urbanheat-au/actions/runs/45637913010) · [UHA-50](https://urban-heatmap.atlassian.net/browse/UHA-50)
