# Sprint 4 — final evidence supplement (25 November 2026)

This supplement adds verified status to the [Sprint 4 progress report](https://urban-heatmap.atlassian.net/wiki/spaces/UHA/pages/13205506). It is **not final sign-off**.

## Verified repository and CI baseline

- Default branch: `main`, commit `e8d4727b57c1f2d63005c2105b5d66ecdba1ff52` at audit time.
- A **successful PR CI workflow** for the subsequent documentation/closeout work is [UrbanHeat tests #205](https://github.com/urbanheat-au-group4/urbanheat-au/actions/runs/45399459910) (commit `eacf710280c3a834cfc13202d18dbe3e4ceb4338`). Both jobs concluded success: **test** and **Eight-state browser acceptance**.
- The test job includes Python, JavaScript, comparison logic, error handling, shared state/metrics, export-adapter and view-model checks.
- The browser job uses catalogue coordinates and no-weather fixtures; **it does not validate actual climate measurements**.
- The real-data browser script is syntax-checked in CI, **not run against local 2015–2025 snapshots**.
- CI #205 proves the checked code paths, **not necessarily that the final `main` release is accepted**. The release SHA and its own CI must be recorded again after merges.

## Data integrity: verified facts vs outstanding evidence

- The 19 Nov report records a locally reported **112/112 cached** and zero missing historical snapshots on 18 Nov, but not a fresh independent signed export audit.
- `verify_national_release.py` (PR #88) and `npm run test:real-data` (PR #90) are implementation-ready.
- A repeatable collection script is prepared at `scripts/collect_final_evidence.sh` in release preparation PR #94. Execute on a machine with real saved snapshots: `bash scripts/collect_final_evidence.sh`.
- Attach `artifacts/final-acceptance/<UTC stamp>/manifest.txt`, test logs and `export-audit.json` to UHA-46/UHA-44 after reviewing actual contents.
- For browser verification, start `python3 server.py` with genuine exports and run `npm run test:real-data`, save the resulting evidence JSON and verify its result.

## Ownership and completion boundary

- Dale authored/merged UI PRs #74, #75, #76, #77 and #81 on 12–13 Nov, among other earlier contributions.
- Paul merged foundation-only PRs #91, #92 and #93 to support the redesigned interface. None claims that Dale's tabs or compact UI are implemented.
- Dale's UHA-112–120 remain To Do; do not close them on his behalf.
- Accessibility PR #89 remains open because keyboard-focus defect UHA-111 is unresolved.
- Live hosting checklist [GitHub #63–67](https://github.com/urbanheat-au-group4/urbanheat-au/issues/63) is open and should not be treated as demonstrated release delivery.

## Final Sprint 4 report/acceptance completion checklist

- [ ] Tested release main SHA, green CI run and screenshots
- [ ] Real snapshot independent export audit (dated log + JSON)
- [ ] Browser real-data comparison results from actual dataset
- [ ] Manual national map/geography, keyboard/focus and screen-reader review
- [ ] Dale UI acceptance, or explicitly approved deferral of optional redesign
- [ ] Public deployment and data-provenance verification
- [ ] Five-minute rehearsal, team contributions and retrospective evidence
- [ ] Jira UHA-44, UHA-46, UHA-47, UHA-50, UHA-51 signed off with actual artifacts

### Known accuracy limitations for final presentation

Open-Meteo ERA5 gives modelled values for 2015–2025; these are not official station measurements or current forecasts. State colouring reflects sampled catalogue locations, not a full gridded state average. Nearby cities may share ERA5 grid cells. Do not show illustrative mockup normal baselines or placeholder temperatures as measured data.
