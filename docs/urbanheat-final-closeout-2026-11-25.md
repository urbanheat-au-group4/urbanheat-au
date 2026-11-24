# UrbanHeat AU | What we need to finish

**Updated:** 25 November 2026  
**My work:** tests, data checks, documentation and the final demo  
**Dale's work:** UI changes under UHA-94 and UHA-112

## Where we are

The national map, charts and comparison features have been built. We still need to check the final version and save the results.

I am keeping the tasks open until we have test results or screenshots to show they work. A green test using sample data is useful, but it does not prove our real weather figures are correct.

## What I need to check

| Task | Jira | What will show it is finished |
| --- | --- | --- |
| Check our saved weather data | UHA-46, UHA-107 | Final coverage report and JSON audit for all 112 locations |
| Check real values on the website | UHA-44 | Browser results match the actual exported figures |
| Check the national map | UHA-74, UHA-82 | All eight states work, with 14 locations each and readable labels |
| Run all tests | UHA-44 | Link to the passing CI run and the tested commit |
| Check accessibility | UHA-47 | Keyboard, focus, contrast and screen-reader review |
| Check the hosted website | GitHub #63–67 | Working link, real data or clear no-data labels, and deployment result |
| Rehearse the demo | UHA-50 | Screenshots or recording of the actual demo |
| Finish the Sprint 4 report | UHA-51 | Final outcomes, contributions, problems and what we learned |
| Review Dale's new layout | UHA-94, UHA-112–120 | Dale's PR, screenshots and reviewed UI tests |

## Run the final data checks

Use the computer that has our downloaded historical weather files. From the project folder:

```bash
bash scripts/collect_final_evidence.sh
```

The script saves dated test logs in `artifacts/final-acceptance/`. It checks the Python tests, rebuilds data from our saved files and compares the map, history and seasonal exports.

If the saved data is missing, the script stops. Do not use the browser test data as real weather readings.

To check values in the browser, first start the app:

```bash
python3 server.py
```

Then, in a second terminal:

```bash
npm run test:real-data
```

Read the results and attach the evidence to UHA-44 and UHA-46. Do not mark a task Done just because the command ran.

## What the last GitHub tests tell us

[CI run #207](https://github.com/urbanheat-au-group4/urbanheat-au/actions/runs/45400496287) passed the Python/JavaScript checks and eight-state browser tests for an earlier version of this PR.

The browser tests used the real list of locations but not real temperature readings. The final version still needs its own checks, and the real-data test must run on the saved snapshots.

## What Dale still needs to finish

Dale has already merged improvements to the layout, labels, charts and mobile buttons. His newer desktop design with Overview, Historical and Compare tabs has not been accepted yet.

I will not change his UI files or close those tickets for him. Once his work is submitted, we can test it with the rest of the app.

## Things we must explain in the report

- The figures come from Open-Meteo ERA5 historical models for **2015–2025**. They are not live measurements.
- State colours summarise our 14 selected locations, not every place in a state.
- Nearby locations may share the same model grid, so small differences are not always meaningful.
- The map coordinates still need an independent geography check.
- The example numbers and 1981–2010 baseline in the UI mockup are not real data in our app.

## Before we mark the project finished

- [ ] Save the test logs and final Git commit
- [ ] Check the actual weather exports and browser values
- [ ] Review the state maps, labels and keyboard controls
- [ ] Record any known problems and how we handled them
- [ ] Complete the demo and take screenshots
- [ ] Update the Sprint 4 report and Jira evidence
- [ ] Get the final review before closing the remaining tasks

**Current result:** The closeout work is prepared, but the final data tests and demo still need to be completed.
