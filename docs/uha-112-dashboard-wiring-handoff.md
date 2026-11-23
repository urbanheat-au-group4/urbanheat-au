# UHA-112 · Shared dashboard wiring for Dale

This is **non-UI preparation**. The live page, CSS and existing national map scripts have not been changed. Dale owns the visual implementation under UHA-112 and UHA-94.

## What is ready

- `static/dashboard_state.js`: shared selected city, state-only zoom, baseline city, current metric and active tab. Works with plain browser scripts (global `UrbanHeatState`) and Node tests (`require`).
- `static/dashboard_metrics.js`: shared labels, units, null-safe differences, monthly series and ERA5 25 km grid warning. Browser global `UrbanHeatMetrics`.
- `tests/test_dashboard_foundations.cjs`: offline tests for tab persistence, swap, filtering, selection, null values, units and near-grid comparisons.

## Read the three exports once (new data adapter)

`static/dashboard_data.js` now provides the `UrbanHeatData` API. It loads the existing map, annual history and season files concurrently, **validates source/model/period**, indexes every record by its catalogue ID and reports missing/skipped locations. It does not alter the existing page or write fabricated values.

Dale can add it before his new controller:

```html
<script src="/static/dashboard_data.js"></script>
```

```js
const bundle = await UrbanHeatData.load();
const store = UrbanHeatState.newStore(bundle.locations);
const view = bundle.forSelection(store.getState());

// view.selected.map          = national_data.json point, or null
// view.selected.history      = national_history.json record, or null
// view.selected.seasons      = national_seasons.json record, or null
// view.baseline.*            = the same three records for the baseline city
// bundle.warnings            = missing/skipped source-data warnings
// bundle.source              = model, source, start and end date
```

The three existing chart scripts currently fetch their JSON separately. **Do not remove those scripts or duplicate the loaders until Dale integrates the adapter**; this PR supplies a new reusable API only, so the current application remains stable. Existing exports are generated locally, not stored in Git, and the CI tests therefore use small, deterministic representative fixtures. A missing history/season record stays `null` for that location, never another city's data. If metadata disagree, the adapter fails with a rebuild message rather than mixing periods.

## How Dale wires the new layout

Add these plain scripts **before** any new dashboard controller:

```html
<script src="/static/dashboard_state.js"></script>
<script src="/static/dashboard_metrics.js"></script>
<script src="/static/dashboard_ui.js"></script>
```

The `dashboard_ui.js` filename is an **example of Dale's eventual controller**, not a file supplied in this PR.

After loading `/static/national_data.json`, initialise one shared store:

```js
const store = UrbanHeatState.newStore(data.locations);
store.subscribe(state => {
  // Dale: update the shared selectors, visible tab and panels.
  // Do not redraw weather data with hard-coded sample numbers.
});
store.selectState('NSW');          // Zoom/filter before city is selected
store.selectCity('sydney');        // Use ACTUAL location ID from export
store.selectBaseline('melbourne'); // Use ACTUAL location ID from export
store.selectTab('historical');     // Keeps both cities and chosen metric
```

The `sydney` and `melbourne` IDs above are illustrative. Use IDs present in the export, not assumptions.

When two cities are selected:

```js
const snapshot = store.getState();
const result = UrbanHeatMetrics.compareRows(snapshot.selected, snapshot.baseline);
result.rows.forEach(row => {
  // row.selectedText, row.baselineText, row.differenceText
  // row.difference === null is NOT zero: show a no-data/nearby warning.
});
const months = UrbanHeatMetrics.monthlySeries(snapshot.selected);
```

Use the existing `CompareCore` module for the more detailed **seasonal** comparison and its years-used caveats; the new metrics module intentionally doesn't duplicate those calculations.

## Source contract and limits

- All numeric field keys come from existing `national_data.json`, with a 2015–2025 ERA5 scope. No historical 1981–2010 baseline is provided.
- This shared store is **in memory only**: it persists while switching tabs in the same page, but does not yet provide URL persistence or local storage. Dale may add either after acceptance.
- State-only zoom is represented separately from city selection, avoiding a forced arbitrary city.
- Selecting the same city twice clears the baseline. Distances below 25 km suppress model-grid differences; missing coordinates also prevent an asserted numerical delta.
- The state store does **not yet modify the DOM** or attach to the existing `national.js`, `history.js`, `seasons.js` or `compare.js`. Dale should integrate it in his own UI branch to avoid merge collisions.
- Visual screenshots from the mockup contain illustrative figures. Production numbers **must** be loaded from validated exports.

## Verification

```bash
node --test tests/test_dashboard_foundations.cjs
```

The full Python/browser CI remains responsible for existing behaviour. The new module tests are separate and deterministic.

## Implementation order and tickets

| Task | Deliverable |
| --- | --- |
| UHA-113 | Review editable [Figma layout](https://www.figma.com/design/XREaeFem1Vtf9DEeC48l5t) |
| UHA-114 | Create tabs and use `UrbanHeatState` as single source of selection truth |
| UHA-115 | Reflow existing national map; preserve annotations/112 locations |
| UHA-116 | Bind baseline selector and `UrbanHeatMetrics.compareRows` |
| UHA-117 | Bind historical/seasonal charts to shared location IDs |
| UHA-118 | Reuse `CompareCore` for detailed side-by-side comparison |
| UHA-119 | Test responsive, accessible focus; existing UHA-111 requires Dale's review |
| UHA-120 | Screenshot, run tests/CI, PR and peer review |

**Review gates:** no body scrolling at 1440×900 and 1366×768, no overlap; phones may scroll vertically. No fabricated readings; no regression in existing tests; no UI code changed outside Dale's owned branch.
