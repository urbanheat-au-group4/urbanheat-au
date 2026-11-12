// Calculations for the "Compare locations" section.
// There is no page code in this file, so the same file runs in the browser and in the Node tests.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CompareCore = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // The ERA5 model works on a grid of about 25 km. Locations closer together than this can
  // share the same modelled values, so they are not ranked against each other.
  const NEAR_KM = 25;
  const MIN_LOCATIONS = 2;
  const MAX_LOCATIONS = 3;

  const DEGREES_C = '\u00b0C';
  const MEASURES = [
    { key: 'summer_max_c', label: 'Typical summer maximum', unit: DEGREES_C, decimals: 1 },
    { key: 'winter_min_c', label: 'Typical winter minimum', unit: DEGREES_C, decimals: 1 },
    { key: 'hot_days', label: 'Hot days per year (35 ' + DEGREES_C + ' or more)', unit: 'days', decimals: 1 },
    { key: 'annual_rain_mm', label: 'Average annual rainfall', unit: 'mm', decimals: 0 },
    { key: 'summer_rain_mm', label: 'Typical summer rainfall', unit: 'mm', decimals: 0 },
    { key: 'winter_rain_mm', label: 'Typical winter rainfall', unit: 'mm', decimals: 0 }
  ];

  // Seasonal figures only count years with a value for every day, so the number of years can differ.
  const YEAR_LABELS = {
    summer_max_c: 'summer maximum',
    winter_min_c: 'winter minimum',
    summer_rain_mm: 'summer rainfall',
    winter_rain_mm: 'winter rainfall'
  };

  function isNum(value) {
    return typeof value === 'number' && Number.isFinite(value);
  }

  function numberOrNull(value) {
    return isNum(value) ? value : null;
  }

  function distanceKm(a, b) {
    const rad = degrees => degrees * Math.PI / 180;
    const dLat = rad(b.latitude - a.latitude);
    const dLon = rad(b.longitude - a.longitude);
    const h = Math.sin(dLat / 2) ** 2 +
      Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  function findSeason(seasonLocation, name) {
    const list = seasonLocation && Array.isArray(seasonLocation.seasons) ? seasonLocation.seasons : [];
    return list.find(item => item.season === name) || null;
  }

  function yearCount(season, field) {
    return season && Array.isArray(season[field]) ? season[field].length : 0;
  }

  // Joins one location's yearly figures (national_data.json) with its seasonal figures (national_seasons.json).
  function buildRecord(point, seasonLocation) {
    const summer = findSeason(seasonLocation, 'summer');
    const winter = findSeason(seasonLocation, 'winter');
    return {
      id: point.id,
      name: point.name,
      state: point.state,
      latitude: point.latitude,
      longitude: point.longitude,
      values: {
        summer_max_c: numberOrNull(summer && summer.typical_max),
        winter_min_c: numberOrNull(winter && winter.typical_min),
        hot_days: numberOrNull(point.average_days_at_least_35c),
        annual_rain_mm: numberOrNull(point.average_annual_rainfall_mm),
        summer_rain_mm: numberOrNull(summer && summer.typical_precip),
        winter_rain_mm: numberOrNull(winter && winter.typical_precip)
      },
      yearsUsed: {
        summer_max_c: yearCount(summer, 'max_years'),
        winter_min_c: yearCount(winter, 'min_years'),
        summer_rain_mm: yearCount(summer, 'precip_years'),
        winter_rain_mm: yearCount(winter, 'precip_years')
      }
    };
  }

  // The same location cannot be chosen twice. Keeps the first copy and drops blanks.
  function uniqueIds(ids) {
    const seen = new Set();
    return ids.filter(id => id && !seen.has(id) && seen.add(id));
  }

  function nearbyPairs(records) {
    const pairs = [];
    for (let i = 0; i < records.length; i += 1) {
      for (let j = i + 1; j < records.length; j += 1) {
        const km = distanceKm(records[i], records[j]);
        if (km < NEAR_KM) { pairs.push({ i, j, a: records[i].name, b: records[j].name, km }); }
      }
    }
    return pairs;
  }

  function formatNumber(value, decimals) {
    return isNum(value) ? value.toFixed(decimals) : null;
  }

  function formatDifference(difference, decimals, unit) {
    if (!isNum(difference)) { return ''; }
    if (difference === 0) { return 'same'; }
    return (difference > 0 ? '+' : '-') + Math.abs(difference).toFixed(decimals) + ' ' + unit;
  }

  function coverageNotes(records) {
    const parts = [];
    Object.keys(YEAR_LABELS).forEach(key => {
      const counts = records.map(record => record.yearsUsed[key]);
      if (new Set(counts).size > 1) {
        const detail = records.map((record, i) => record.name + ': ' + counts[i]).join(', ');
        parts.push(YEAR_LABELS[key] + ' (' + detail + ')');
      }
    });
    if (!parts.length) { return []; }
    return [{
      type: 'coverage',
      text: 'Some figures are based on a different number of years for each location, so they do not use ' +
        'exactly the same years. Years used: ' + parts.join('; ') + '.'
    }];
  }

  function periodNotes(meta) {
    if (!meta || !meta.dataStart || !meta.seasonsStart) { return []; }
    if (meta.dataStart === meta.seasonsStart && meta.dataEnd === meta.seasonsEnd) { return []; }
    return [{
      type: 'period',
      text: 'The yearly figures (' + meta.dataStart + ' to ' + meta.dataEnd + ') and the seasonal figures (' +
        meta.seasonsStart + ' to ' + meta.seasonsEnd + ') do not cover the same period. Read them with care.'
    }];
  }

  function nearbyNotes(pairs) {
    return pairs.map(pair => ({
      type: 'nearby',
      text: pair.a + ' and ' + pair.b + ' are only about ' + Math.max(1, Math.round(pair.km)) +
        ' km apart. The climate model works on a grid of about ' + NEAR_KM +
        ' km, so it cannot reliably tell them apart. Differences between them are not shown.'
    }));
  }

  // Builds the side-by-side table. The first location is the one the others are compared with.
  function compare(records, meta) {
    const chosen = records.slice(0, MAX_LOCATIONS);
    if (chosen.length < MIN_LOCATIONS) {
      return { records: chosen, rows: [], nearby: [], notes: [{ type: 'info', text: 'Choose at least two locations to compare.' }] };
    }
    const nearby = nearbyPairs(chosen);
    const nearFirst = index => nearby.some(pair => pair.i === 0 && pair.j === index);
    const rows = MEASURES.map(measure => {
      const values = chosen.map(record => record.values[measure.key]);
      const differences = values.map((value, i) => {
        if (i === 0 || nearFirst(i) || !isNum(value) || !isNum(values[0])) { return null; }
        return Number((value - values[0]).toFixed(measure.decimals)) || 0;
      });
      return {
        key: measure.key,
        label: measure.label,
        unit: measure.unit,
        decimals: measure.decimals,
        values,
        differences
      };
    });
    const notes = [].concat(nearbyNotes(nearby), periodNotes(meta), coverageNotes(chosen));
    return { records: chosen, rows, nearby, notes };
  }

  return {
    NEAR_KM, MIN_LOCATIONS, MAX_LOCATIONS, MEASURES,
    distanceKm, buildRecord, uniqueIds, nearbyPairs, compare, formatNumber, formatDifference
  };
}));