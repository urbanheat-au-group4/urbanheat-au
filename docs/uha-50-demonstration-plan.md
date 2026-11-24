# UHA-50 | Our final demonstration

**Updated:** 25 November 2026  
**Status:** Ready to rehearse, not yet completed

## What we will show

UrbanHeat AU displays historical climate information for 112 selected locations across Australia. The data comes from Open-Meteo ERA5 models for 2015–2025. It is not a live weather forecast.

## Before we start

1. Use the latest tested version of the app, with the real historical data files.
2. Run `python3 run.py --check` and make sure it succeeds.
3. Run `python3 verify_national_release.py` and review the result.
4. Start the site with `python3 run.py`.
5. Open `http://localhost:8000/` and check one city's actual figures against the saved export.
6. Check that the map, chart labels and units are readable on the demo screen.

If the weather data is missing, do not show example temperatures as real measurements.

## Five-minute plan

| Time | What we show | What we explain |
| --- | --- | --- |
| 0:00–0:40 | National homepage | Eight states and territories, 112 selected locations |
| 0:40–1:30 | Select Victoria or NSW | Zoom into a state and show its 14 locations |
| 1:30–2:20 | Choose a city | Explain the temperature, rainfall and hot-day figures |
| 2:20–3:10 | Change the heat measure | Show the hottest modelled day and hottest 10%, 25% and 50% of days |
| 3:10–4:00 | Open historical and seasonal charts | Explain monthly highs and how temperatures change through the year |
| 4:00–4:40 | Compare two locations | Explain what is similar or different, using the same model and years |
| 4:40–5:00 | Explain testing and limits | Describe how we checked data and why modelled values have limits |

Use the actual interface that is ready on demonstration day. If Dale's updated tabs are merged, follow those tabs. Otherwise, show the existing working dashboard.

## What I will say about the limitations

- ERA5 gives modelled temperatures and rainfall, not readings from a weather station in every suburb.
- State colours represent our selected places, not a temperature reading for the whole state.
- Nearby places may share the same model grid, so a tiny difference is not always meaningful.
- Missing measurements stay missing. We do not fill them with invented numbers.

## If the downloaded data is unavailable

Use a **separate clean copy** of the project and prepare the map-only test data:

```bash
python3 tests/prepare_national_browser_data.py
python3 fetch_national_boundaries.py
python3 server.py
```

Tell the audience that it is an interface-only demonstration without real weather figures. Never replace the real historical exports with test fixtures.

## After the rehearsal

- [ ] Record the date and tested Git commit
- [ ] Save a screenshot or short recording
- [ ] Confirm the eight state views and 14 locations per state
- [ ] Check a real temperature value against the export
- [ ] Check missing-data messages
- [ ] Check keyboard use and phone layout
- [ ] Record any problems we found
- [ ] Confirm who presents each part

Attach the results to UHA-50. The runbook being written does not mean the rehearsal has happened.
