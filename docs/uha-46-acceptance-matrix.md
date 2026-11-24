# UHA-46 | Final testing checklist

**Updated:** 25 November 2026  
**Status:** In Progress

Our goal is to check that the national dashboard works with real saved weather data, not just test examples.

## What I need to check

| Check | How I will check it | Result |
| --- | --- | --- |
| National homepage opens | Start the app and open the homepage | Pending final check |
| Eight states display correctly | Use the map and state dropdown | Pending final screenshot review |
| Each state has 14 locations | Check the catalogue and map | Automated test available; manual check pending |
| Map and selected location agree | Click markers and compare labels and readings | Pending real-data check |
| Monthly and historical charts work | Select locations and compare the figures with exports | Pending real-data check |
| Seasonal charts work | Check season values and missing-data labels | Pending real-data check |
| Comparison works | Choose two locations and check units and differences | Pending real-data check |
| Missing data is handled correctly | Check messages and saved-data validation | Automated tests available |
| Python and browser tests pass | Save CI link and tested commit | Final-main result pending |
| Keyboard and mobile use works | Test phone, tablet, keyboard and focus order | Manual check pending |
| Final demo works | Rehearse it and save screenshots | Not completed |

## How to collect the evidence

Run this on the computer with the historical weather files:

```bash
bash scripts/collect_final_evidence.sh
```

The script saves a dated folder under `artifacts/final-acceptance/` with test results and any export audit it could complete.

Then start the app:

```bash
python3 server.py
```

In another terminal:

```bash
npm run test:real-data
```

Keep the command output, the generated reports, and screenshots. Link them in UHA-44 and UHA-46.

**Important:** The browser CI uses location names and test files, not our real weather readings. It cannot replace the real-data test.

## Known problems

- UHA-111: check that selecting a map marker with the keyboard moves focus to the Find a location dropdown and lets users keep tabbing.
- UHA-107: the importer previously made requests that were too large. The smaller batch importer was added, but a final real-data audit is still needed.
- We have not independently verified every location's coordinates.
- Dale's outstanding UI work belongs to Dale and is not covered by this checklist.

## Evidence record

| Evidence | Link or result |
| --- | --- |
| Final commit tested | Pending |
| Python tests and browser CI | Pending final commit |
| Real historical coverage | Pending new audit |
| Map, history and seasons exports | Pending new audit |
| Real-data browser results | Pending |
| Desktop and phone screenshots | Pending |
| Keyboard and accessibility review | Pending |
| Demo rehearsal | Pending |
| Final reviewer decision | Pending |

I will only mark UHA-46 Done after the checks have results and the final review is recorded.
