# UHA-51 | Sprint 4 delivery and test results

**CST190 Group 4 · Updated 26 November 2026**
[Main Sprint 4 report in Confluence](https://urban-heatmap.atlassian.net/wiki/spaces/UHA/pages/13205506)

## What we delivered

UrbanHeat AU now opens directly to the Australian climate map. The public site has 112 locations across all eight states and territories. The Overview, Historical and Compare tabs share the selected place and baseline. The dashboard shows the hottest days, monthly highs, annual trends and seasonal conditions from Open-Meteo ERA5 for 2015–2025.

## What we checked

- The release audit found 112 complete daily snapshots. It checked that the three exports cover the same locations, dates and model.
- GitHub Pages built and deployed from `main`. The live files matched the tested package.
- All 139 Python tests, 48 JavaScript tests and the browser workflow passed on the released app. The browser compared real export values with all eight state views and checked unavailable data using a separate fixture.
- Keyboard and reflow checks passed across the three tabs at five widths. We fixed disappearing focus, labels that differed from their accessible names and sideways scrolling at 320 px.
- We rehearsed the demo in the browser using Launceston and Timber Creek. We checked the readings, charts, baseline swap and the message when the history file fails.

## Team contributions

Dale refined the layout, state labels, selected-location panels, phone controls and charts. His original tabbed layout is included in the merged history of PR #100. Paul handled national mapping, historical data and test coordination, worked on the shared controls and final integration, and verified the Pages release. Follow-up fixes and evidence are linked from PR #104.

## Retrospective

Small, resumable weather requests helped us finish the data import after provider rate limits. The most useful testing change was running the browser on both the real published summaries and the missing-data fixture. That showed that real values and the fallback both worked. Next time, we would test focus and narrow screen layouts before merging a new layout.

## Remaining review

An independent screen-reader and usability session and final acceptance sign-off are still open. Location IDs and map behaviour passed the automated checks. The release audit checks dataset coverage and consistency. The measurements are modelled estimates, and state colours describe the sampled locations.

[Live dashboard](https://urbanheat-au-group4.github.io/urbanheat-au/) · [Dale’s merged work](https://github.com/urbanheat-au-group4/urbanheat-au/pull/100) · [Browser evidence](https://github.com/urbanheat-au-group4/urbanheat-au/actions/runs/45637913010) · [Acceptance matrix](uha-46-acceptance-matrix.md) · [Rehearsed demo](uha-50-demonstration-plan.md)
