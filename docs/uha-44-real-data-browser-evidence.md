# UHA-44: Browser verification using real historical exports

**Purpose:** Verify the final local website against its **real saved climate export**, rather than using the synthetic browser fixtures in GitHub CI.

## Steps

Run in the UrbanHeat AU project directory:

```bash
git pull origin main
python3 run.py --check
python3 verify_national_release.py
python3 server.py
```

In a second terminal (with Node modules and Chromium installed):

```bash
npm install
npx playwright install chromium
npm run test:real-data
```

The test reads the existing `static/national_data.json` without modifying it or intercepting network responses. It checks the real-data file's ERA5 model, 2015–2025 period, all 112 locations and monthly series. In the browser it visits every state, verifies its 14 markers, selects a sample location, then compares six visible metrics and 12 monthly chart values with the actual exported record.

Output: `artifacts/uha-44-real-browser.json`. Attach this file, `artifacts/uha-46-export-audit.json` and the local run output to Jira UHA-44 / UHA-82 / UHA-46.

**Important:** GitHub CI only checks the script's syntax. The repository does not include the user's full saved 2015–2025 snapshots, so the real-data browser run must occur locally. Never upload the large historical dataset just to force a green CI. Do not mark final acceptance Done solely because these automated checks pass; coordinate accuracy and manual UI/accessibility reviews require independent evidence.

### If this fails

Keep the script's failure output and JSON report. File a reproducible Jira bug with the relevant state, location ID, metric, expected and actual display. The script intentionally fails closed instead of silently using synthetic values.
