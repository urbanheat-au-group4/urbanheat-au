// Shared selection state for the future tabbed national dashboard.
// No DOM, framework, network, or storage required. Node and browsers both work.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.UrbanHeatState = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const TABS = ['overview', 'historical', 'compare'];
  const DEFAULT_METRIC = 'annual_average_max_c';

  function newStore(locations, options = {}) {
    if (!Array.isArray(locations)) throw new TypeError('locations must be an array');
    const byId = new Map();
    for (const point of locations) {
      if (!point || typeof point.id !== 'string' || !point.id) continue;
      byId.set(point.id, point);
    }
    const listeners = new Set();
    const allowedMetrics = options.metrics || [
      'annual_mean_c', 'annual_average_max_c', 'annual_average_min_c',
      'hottest_day_c', 'hottest_10_percent_mean_c',
      'hottest_25_percent_mean_c', 'hottest_50_percent_mean_c',
      'average_annual_rainfall_mm', 'average_days_at_least_35c'
    ];
    const validId = id => typeof id === 'string' && byId.has(id) ? id : '';
    const validTab = tab => TABS.includes(tab) ? tab : 'overview';
    const validMetric = metric => allowedMetrics.includes(metric) ? metric : DEFAULT_METRIC;
    let current = {
      tab: validTab(options.tab),
      cityId: validId(options.cityId),
      baselineId: validId(options.baselineId),
      metric: validMetric(options.metric),
    };
    // Same location is a selection, not a valid comparison.
    if (current.cityId === current.baselineId) current.baselineId = '';

    function snapshot() {
      const selected = byId.get(current.cityId);
      const baseline = byId.get(current.baselineId);
      return Object.freeze({
        ...current,
        state: selected ? selected.state : 'ALL',
        baselineState: baseline ? baseline.state : 'ALL',
        selected: selected || null, baseline: baseline || null
      });
    }
    function update(patch) {
      const next = { ...current, ...patch };
      next.cityId = validId(next.cityId);
      next.baselineId = validId(next.baselineId);
      next.tab = validTab(next.tab);
      next.metric = validMetric(next.metric);
      if (next.cityId && next.cityId === next.baselineId) next.baselineId = '';
      if (Object.keys(current).every(k => current[k] === next[k])) return snapshot();
      current = next;
      const result = snapshot();
      for (const fn of [...listeners]) fn(result);
      return result;
    }
    function selectCity(id) {
      return update({ cityId: id });
    }
    function selectBaseline(id) {
      return update({ baselineId: id });
    }
    function selectState(code) {
      // A state selection is a map filter, not an invented city selection.
      const point = byId.get(current.cityId);
      return update({ cityId: point && point.state === code ? current.cityId : '' });
    }
    function swap() {
      return update({ cityId: current.baselineId, baselineId: current.cityId });
    }
    function subscribe(fn) {
      if (typeof fn !== 'function') throw new TypeError('listener must be a function');
      listeners.add(fn);
      return () => listeners.delete(fn);
    }
    return Object.freeze({
      getState: snapshot, selectCity, selectBaseline, selectState, swap,
      selectMetric: metric => update({ metric }),
      selectTab: tab => update({ tab }),
      update, subscribe,
      getLocation: id => byId.get(id) || null,
      locations: () => [...byId.values()],
    });
  }

  return Object.freeze({ TABS, DEFAULT_METRIC, newStore });
}));
