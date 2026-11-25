# UHA-46 | Final testing results

**Checked on 26 November 2026** against application commit `93d34b9da555076671a0a261ae3e9b38a2556ba5`.

| Check | Result |
| --- | --- |
| Public homepage and state navigation | GitHub Pages opens the national map. Chromium checked all eight jurisdictions, 14 locations per view and the return to Australia. |
| Daily coverage and published summaries | The release audit passed for 112/112 saved snapshots. Map, annual and seasonal summaries agreed on catalogue IDs, ERA5 and the 2015–2025 period. |
| Real readings in the browser | Checked six map measures and the 12 monthly values for one location in each jurisdiction. Launceston’s 13.4 °C modelled annual mean matched the export. |
| Shared controls and charts | Historical kept Launceston selected and showed the annual, seasonal and monthly views. Compare used Timber Creek as the baseline and swapped the pair correctly. |
| Missing data | The catalogue-only fixture, missing readings and failed history/season endpoints showed clear guidance. |
| Regression | All 139 Python tests, 48 JavaScript unit tests and the GitHub browser workflow passed. |
| Keyboard, phone layout and contrast | Checks passed at 320, 390, 768, 1366 and 1440 px with and without data. The sampled text contrast was 6.08:1–15.22:1. |
| Demonstration | The browser rehearsal passed on the packaged build. See the [demonstration plan](uha-50-demonstration-plan.md). |
| Manual accessibility and sign-off | Independent screen-reader and usability review, plus the final reviewer’s decision, remain open. |

## Reproduce

With the real snapshots available under `data/national`, run:

```bash
python3 verify_national_release.py --data-dir data/national --static-dir data/pages-climate
```

The browser workflow tests both the catalogue-only fixture and the packaged build using the committed summaries. The release audit checks file coverage and consistency. The reported data is modelled, and independent coordinate checks outside the separately reviewed NSW sample remain out of this audit.

[Live site](https://urbanheat-au-group4.github.io/urbanheat-au/) · [Browser results and screenshots](https://github.com/urbanheat-au-group4/urbanheat-au/actions/runs/45637913010) · [Pages deployment](https://github.com/urbanheat-au-group4/urbanheat-au/actions/runs/45638323672) · [Manual accessibility review](https://urban-heatmap.atlassian.net/browse/UHA-47)
