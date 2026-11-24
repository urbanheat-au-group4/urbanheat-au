// Presentation-ready data contract for Dale's three dashboard tabs.
// Pure functions only: no DOM, no fetch, no graphics, no hard-coded temperatures.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./dashboard_metrics.js'));
  } else {
    root.UrbanHeatViewModel = factory(root.UrbanHeatMetrics);
  }
}(typeof self !== 'undefined' ? self : this, function (metrics) {
  'use strict';
  if (!metrics) throw new Error('UrbanHeatMetrics must be loaded first');

  const TABS = ['overview', 'historical', 'compare'];

  function make(bundle, state) {
    if (!bundle || typeof bundle.forSelection !== 'function') {
      throw new TypeError('A validated UrbanHeatData bundle is required');
    }
    if (!state || !TABS.includes(state.tab)) {
      throw new TypeError('A valid UrbanHeatState snapshot is required');
    }
    const records = bundle.forSelection(state);
    const current = records.selected.map;
    const baseline = records.baseline.map;
    const historical = records.selected.history;
    const baselineHistory = records.baseline.history;
    const seasonal = records.selected.seasons;
    const baselineSeasons = records.baseline.seasons;
    const comparisons = metrics.compareRows(current, baseline);
    const selectedMetric = metrics.METRICS.find(item => item.key === state.metric) || null;
    const value = selectedMetric ? metrics.value(current, state.metric) : null;
    const warnings = [...bundle.warnings, ...comparisons.notes];

    return {
      activeTab: state.tab,
      selection: {
        cityId: state.cityId,
        state: state.state,
        baselineId: state.baselineId,
        baselineState: state.baselineState,
        metric: state.metric,
        cityName: current ? current.name : null,
        baselineName: baseline ? baseline.name : null
      },
      overview: {
        locations: bundle.byState(state.state),
        selected: current,
        baseline,
        selectedMetric: selectedMetric ? {
          key: selectedMetric.key, label: selectedMetric.label, unit: selectedMetric.unit,
          value
        } : null,
        metrics: comparisons.rows,
        monthly: metrics.monthlySeries(current)
      },
      historical: {
        selected: historical,
        baseline: baselineHistory,
        selectedSeasons: seasonal,
        baselineSeasons,
        hasSelectedHistory: !!historical,
        hasBaselineHistory: !!baselineHistory,
        hasSelectedSeasons: !!seasonal,
        hasBaselineSeasons: !!baselineSeasons
      },
      compare: {
        ready: !!current && !!baseline && current.id !== baseline.id,
        rows: comparisons.rows,
        nearby: comparisons.nearby,
        distanceKm: comparisons.distanceKm
      },
      source: bundle.source,
      warnings
    };
  }

  return Object.freeze({ make });
}));
