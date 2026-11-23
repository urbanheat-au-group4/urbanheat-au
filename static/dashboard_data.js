// Shared, read-only loader for the three existing UrbanHeat national exports.
// Zero DOM changes: Dale's UI chooses how and when to display the returned data.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.UrbanHeatData = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const FILES = Object.freeze({
    map: '/static/national_data.json',
    history: '/static/national_history.json',
    seasons: '/static/national_seasons.json'
  });

  function assertExport(data, label) {
    if (!data || !Array.isArray(data.locations)) {
      throw new Error(label + ': location records are missing');
    }
    if (!data.model || !data.start_date || !data.end_date || !data.source) {
      throw new Error(label + ': source, model or historical period missing');
    }
    const ids = new Set();
    for (const row of data.locations) {
      if (!row || typeof row.id !== 'string' || !row.id || ids.has(row.id)) {
        throw new Error(label + ': missing or duplicated location ID');
      }
      ids.add(row.id);
    }
    return data;
  }

  function metadata(data) {
    return [data.model, data.start_date, data.end_date];
  }
  function sameMetadata(a, b) {
    const x = metadata(a), y = metadata(b);
    return x.every((item, i) => item === y[i]);
  }

  function makeBundle(map, history, seasons) {
    assertExport(map, 'map');
    assertExport(history, 'history');
    assertExport(seasons, 'seasons');
    if (!sameMetadata(map, history) || !sameMetadata(map, seasons)) {
      throw new Error('National export model or historical period mismatch. Run python3 run.py --check.');
    }

    const mapById = new Map(map.locations.map(point => [point.id, point]));
    const historyById = new Map(history.locations.map(point => [point.id, point]));
    const seasonsById = new Map(seasons.locations.map(point => [point.id, point]));
    const missing = {
      map: [], history: [], seasons: []
    };
    // A missing location must stay missing. Never borrow data from another city.
    for (const id of mapById.keys()) {
      if (!historyById.has(id)) missing.history.push(id);
      if (!seasonsById.has(id)) missing.seasons.push(id);
    }
    for (const id of historyById.keys()) if (!mapById.has(id)) missing.map.push(id);
    for (const id of seasonsById.keys()) if (!mapById.has(id) && !missing.map.includes(id)) missing.map.push(id);

    const skipped = {
      map: Array.isArray(map.skipped) ? [...map.skipped] : [],
      history: Array.isArray(history.skipped) ? [...history.skipped] : [],
      seasons: Array.isArray(seasons.skipped) ? [...seasons.skipped] : []
    };
    const warnings = [];
    if (Object.values(missing).some(list => list.length)) {
      warnings.push('Some locations are missing from one or more historical exports.');
    }
    if (Object.values(skipped).some(list => list.length)) {
      warnings.push('Some historical locations were skipped because valid readings were unavailable.');
    }
    const get = id => ({
      map: mapById.get(id) || null,
      history: historyById.get(id) || null,
      seasons: seasonsById.get(id) || null
    });

    return Object.freeze({
      locations: Object.freeze([...map.locations]),
      source: Object.freeze({
        name: map.source, model: map.model,
        startDate: map.start_date, endDate: map.end_date,
        note: 'Modelled historical estimates, not weather-station readings'
      }),
      warnings: Object.freeze(warnings),
      missing: Object.freeze(missing),
      skipped: Object.freeze(skipped),
      get,
      byState: state => map.locations.filter(point => state === 'ALL' || point.state === state),
      forSelection: selection => ({
        selected: get(selection.cityId),
        baseline: get(selection.baselineId)
      })
    });
  }

  async function load(fetcher = typeof fetch !== 'undefined' ? fetch : null) {
    if (typeof fetcher !== 'function') throw new TypeError('A fetch function is required');
    const names = Object.keys(FILES);
    // Start all three requests together, not three sequential network round trips.
    const documents = await Promise.all(names.map(async name => {
      let response;
      try {
        response = await fetcher(FILES[name], { cache: 'no-store' });
        if (!response || !response.ok) throw new Error('HTTP ' + (response?.status || 'unknown'));
        return await response.json();
      } catch (error) {
        throw new Error(name + ' export could not be loaded: ' + error.message);
      }
    }));
    return makeBundle(...documents);
  }

  return Object.freeze({ FILES, makeBundle, load });
}));
