# UrbanHeat AU | Simple code review

**Reviewed:** 25 November 2026  
**Goal:** Make the project easier to understand and explain at first-year level.

## What I checked

I checked the repository file list, the main Python data pipeline, its tests and the shared JavaScript modules prepared for the new dashboard. The repository includes 104 tracked paths on main at review time. This is a review of the structure and selected core code, **not a line-by-line test of every file**.

I did not change Dale's HTML, CSS, maps, charts or UI tasks.

## Changes I made

| File | What I changed | Why |
| --- | --- | --- |
| `national_map.py` | Calculate SVG x/y once per location instead of calling `project()` twice | Easier to read and avoids repeated work |
| `national_export.py` | Give the climate fields clear names, build one row at a time and use `Counter` for state totals | The code now follows the same steps as the explanation: load, join, count, save |
| `national_export.py` | Move command-line code into `main()` | Matches the rest of our scripts and makes it easier to test |

The exported JSON keys, units, missing-value rules and locations have not intentionally changed. Existing tests and CI still need to verify that.

## Code I would keep

- `run.py`: the app starts through one simple command and checks saved data first.
- `national_coverage.py` and `verify_national_release.py`: extra checks are justified because we must not use incomplete weather readings.
- `national_ingest.py` and `national_batch.py`: cached data and careful API requests prevent unnecessary downloads and rate-limit problems.
- `climate_statistics.py`: annual and seasonal calculations are best kept separate from the website.
- `static/dashboard_state.js`, `dashboard_data.js`, `dashboard_metrics.js` and `dashboard_view_model.js`: these prepare data for Dale's tabs. They are several small modules rather than a single very large file; merging them now would make his work harder.

## Other areas that could be simplified later

| Area | What I noticed | Decision |
| --- | --- | --- |
| `static/national.js` (about 23 KB) | National map has many responsibilities | Let Dale finish first; changing the UI now risks conflicts |
| `static/app.js` (about 20 KB) and `weather.py` | Older Melbourne/forecast code is still kept for legacy tests | Leave it for now. Removing it needs an agreed scope change and test updates |
| `static/history.js` and `static/seasons.js` | Some chart-handling logic is long | Leave it alone until the final UI is submitted |
| Multiple historical export scripts | Similar checks appear in several places | Do not merge them before sign-off; each file has a clear job and we have tests for them |
| Custom dashboard JavaScript modules | The browser/Node module wrapper looks advanced for year one | Keep it until Dale connects the UI; replacing it now is more risk than benefit |

## Code level we should aim for

Use plain Python and JavaScript, with simple loops, small functions and straightforward names. A first-year student should be able to explain where the data comes from, how a location is checked and how its values reach the map.

Do not remove validation, skip missing data, hard-code temperatures or combine unrelated features just to reduce the number of lines. Less code is only better when it is still correct and easy to test.

## How to test this change

GitHub CI runs the Python and browser checks. For these two files, the important unit tests are:

```bash
python3 -m unittest tests.test_national_map tests.test_national_export -v
```

For a full local check:

```bash
python3 -m unittest discover -s tests -p 'test_*.py' -v
```

After the real historical snapshots are available, run the existing final-data checks as well. These changes do not prove that the actual downloaded climate readings are accurate.

## My conclusion

Most of our code is already divided into sensible, small jobs. The strongest improvement is not rewriting every module. It is making a few confusing parts easier to follow and leaving the tested data rules in place.

**Status:** Backend simplification submitted for review. Do not call it complete until the new PR tests pass.
