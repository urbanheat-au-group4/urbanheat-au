# UHA-50: Final demonstration plan (draft)

**Prepared:** 18 November 2026  
**Status:** Draft for rehearsal. Not evidence that a final demonstration has happened.

## What we are demonstrating

UrbanHeat AU is now a **historical climate explorer**, not a live-weather warning system. Our home page is the national map. We show modelled historical temperatures and rainfall for 112 catalogue locations across eight states and territories, for 2015–2025 when validated data is available.

## Before the demonstration

1. Pull the latest approved `main` branch, with no uncommitted work.
2. Confirm the computer has Python 3 and the locally saved historical snapshots.
3. Run `python3 run.py --check`. Save the terminal output and check the reported coverage.
4. Confirm the three generated exports exist in `static/`: `national_data.json`, `national_history.json` and `national_seasons.json`.
5. Run `python3 run.py` and open `http://localhost:8000/` in a browser.
6. Check a known selected location and its actual exported figures **before presenting**. Confirm the model, period and units on the webpage.
7. Make sure the screen resolution and browser zoom show the map and dropdowns clearly. Keep a second browser tab ready if necessary.

**Stop if the check fails.** It is better to show a transparent missing-data state than to present invented temperatures. UHA-107 tracks Open-Meteo oversized requests; UHA-97 covers the independent data audit.

## Five-minute demonstration script

| Approx. time | What we show | What we explain |
| --- | --- | --- |
| 0:00–0:40 | National homepage | There are 112 catalogue locations, 14 for each state or territory. This is historical modelled weather, not a live forecast. |
| 0:40–1:30 | Select NSW or VIC on the map | State zoom, 14 selectable markers, label readings and return to Australia. |
| 1:30–2:20 | Select a location | Location details, annual temperatures, rainfall and hot-day counts where validated readings exist. |
| 2:20–3:10 | Change the heat metric | Explain hottest modelled day and hottest 10%, 25% and 50% of days. |
| 3:10–4:00 | Open monthly, annual and seasonal charts | January–December mean daily maximum, historical trends and typical seasons. |
| 4:00–4:40 | Compare two locations | Side-by-side difference with the same period and model, where data is available. |
| 4:40–5:00 | Explain testing and limits | State shading reflects sampled places, coordinates need independent verification and missing readings are not filled with guesses. |

## If historical weather files are missing

Show the map and location selection with **catalogue-only, no-weather data** using a separate clean test copy. The test-only file is created with:

```bash
python3 tests/prepare_national_browser_data.py
python3 fetch_national_boundaries.py
python3 server.py
```

The test file deliberately has no climate readings. Tell the audience explicitly that this is an interface demonstration and cannot be used to draw conclusions about the real climate.

**Do not overwrite real exported weather JSON with test fixtures.** The fixture generator refuses to overwrite the existing national export. Use another clean clone rather than deleting validated files.

If the network is down but validated snapshots and boundaries are already saved, the local website can still display prepared data through `python3 server.py`. Avoid restarting an incomplete import.

## Rehearsal checklist

- [ ] Real historical snapshots available and coverage reported.
- [ ] Startup and exports checked on the demo computer.
- [ ] National homepage loads and eight state views are accessible.
- [ ] Selecting a state shows exactly 14 locations.
- [ ] Location, heat measure, data panels and charts stay synchronized.
- [ ] Monthly and yearly figures match the local export files.
- [ ] Missing values show "No data" or a clear error.
- [ ] Keyboard and mobile presentation tested.
- [ ] Screenshot or recording of the actual rehearsal saved.
- [ ] Teammates confirm who presents each part.

## Evidence to attach once rehearsed

Record the date, tested Git commit SHA, exact Python/Node commands and output, chosen sample locations, whether real or fixture data was used, screenshots/recording and any Jira defects. Link the evidence on UHA-50. **Do not mark UHA-50 Done until the rehearsal and final acceptance have happened.**
