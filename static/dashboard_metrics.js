// Shared numeric presentation logic for Overview, Historical and Compare.
// Accepts the EXISTING national_data.json rows. Never invents climate values.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.UrbanHeatMetrics = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const METRICS = Object.freeze([
    { key: 'annual_mean_c', label: 'Average temperature', unit: '°C', places: 1 },
    { key: 'annual_average_max_c', label: 'Average daily maximum', unit: '°C', places: 1 },
    { key: 'hottest_day_c', label: 'Hottest modelled day', unit: '°C', places: 1 },
    { key: 'hottest_10_percent_mean_c', label: 'Average hottest 10% of days', unit: '°C', places: 1 },
    { key: 'hottest_25_percent_mean_c', label: 'Average hottest 25% of days', unit: '°C', places: 1 },
    { key: 'hottest_50_percent_mean_c', label: 'Average hottest 50% of days', unit: '°C', places: 1 },
    { key: 'average_annual_rainfall_mm', label: 'Annual rainfall', unit: 'mm', places: 0 },
    { key: 'average_days_at_least_35c', label: 'Days ≥35°C per year', unit: 'days', places: 1 }
  ]);
  const byKey = new Map(METRICS.map(m => [m.key, m]));
  const value = (row, key) => row && Number.isFinite(row[key]) ? row[key] : null;
  const text = (v, spec) => v === null ? 'No data' : v.toFixed(spec.places) + ' ' + spec.unit;
  // Model resolution is approximately 25 km. Do not imply nearby city-grid differences.
  function distanceKm(a, b) {
    if (![a?.latitude, a?.longitude, b?.latitude, b?.longitude].every(Number.isFinite)) return null;
    const toRad = v => v * Math.PI / 180;
    const dlat = toRad(b.latitude - a.latitude), dlon = toRad(b.longitude - a.longitude);
    const h = Math.sin(dlat / 2) ** 2 + Math.cos(toRad(a.latitude)) *
      Math.cos(toRad(b.latitude)) * Math.sin(dlon / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  function compareRows(selected, baseline) {
    const km = selected && baseline ? distanceKm(selected, baseline) : null;
    const same = selected && baseline && selected.id === baseline.id;
    const nearby = km !== null && km < 25;
    const notes = [];
    if (!baseline) notes.push('Choose a baseline city to compare.');
    if (same) notes.push('Choose two different locations.');
    if (nearby && !same) notes.push('These cities are less than 25 km apart. ERA5 grid values may not distinguish them reliably.');
    if (selected && baseline && km === null) notes.push('Coordinates are missing, so the model grid distance cannot be checked.');
    const rows = METRICS.map(spec => {
      const selectedValue = value(selected, spec.key);
      const baselineValue = value(baseline, spec.key);
      const permitted = selected && baseline && !same && !nearby && km !== null &&
        selectedValue !== null && baselineValue !== null;
      const difference = permitted ? Number((selectedValue - baselineValue).toFixed(spec.places)) : null;
      return {
        key: spec.key, label: spec.label, unit: spec.unit,
        selected: selectedValue, baseline: baselineValue, difference,
        selectedText: text(selectedValue, spec),
        baselineText: text(baselineValue, spec),
        differenceText: difference === null ? 'Not comparable' :
          (difference > 0 ? '+' : '') + difference.toFixed(spec.places) + ' ' + spec.unit
      };
    });
    return { rows, notes, nearby, distanceKm: km };
  }
  function monthlySeries(point) {
    const arr = point && point.monthly_average_max_c;
    return Array.isArray(arr) && arr.length === 12 ?
      arr.map(v => Number.isFinite(v) ? v : null) : Array(12).fill(null);
  }
  function source(data) {
    return {
      source: data?.source || 'Source not specified',
      model: data?.model || 'Model not specified',
      start: data?.start_date || null,
      end: data?.end_date || null,
      warning: 'Modelled estimates, not weather-station observations'
    };
  }
  return Object.freeze({ METRICS, value, compareRows, monthlySeries, source, distanceKm });
}));
