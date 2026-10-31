// Simple layout helpers for the national map.
(function (root) {
  const KEY_LOCATIONS = [
    'darwin', 'qld-cairns', 'qld-mount-isa', 'nt-alice-springs',
    'perth', 'adelaide', 'brisbane', 'sydney',
    'canberra', 'melbourne-cbd', 'hobart'
  ];

  function unit(metric) {
    if (metric === 'average_annual_rainfall_mm') return ' mm';
    if (metric === 'average_days_at_least_35c') return ' days';
    return ' °C';
  }

  function format(value, metric) {
    return Number.isFinite(value) ? value.toFixed(1) + unit(metric) : 'No data';
  }

  function withinBounds(rect) {
    return rect.x >= 8 && rect.y >= 8 &&
      rect.x + rect.width <= 992 && rect.y + rect.height <= 752;
  }

  function overlaps(a, b) {
    return a.x < b.x + b.width + 9 && a.x + a.width + 9 > b.x &&
      a.y < b.y + b.height + 9 && a.y + a.height + 9 > b.y;
  }

  function labelLayout(locations, metric, state, selected) {
    const visible = locations.filter(p => state === 'ALL' || p.state === state);
    const preferred = visible.filter(p => KEY_LOCATIONS.includes(p.id));
    let candidates;
    if (state === 'ALL') {
      candidates = preferred;
    } else {
      // When looking at one state, spread labels over its 14 locations.
      candidates = [...visible].sort((a, b) => a.y - b.y || a.x - b.x)
        .filter((_, i) => i % 3 === 0);
    }
    const chosen = visible.find(p => p.id === selected);
    if (chosen && !candidates.some(p => p.id === chosen.id)) candidates.unshift(chosen);
    // Always prioritise the selected location if there is one.
    if (chosen) candidates.sort((a, b) => Number(b.id === selected) - Number(a.id === selected));

    const placed = [];
    for (const point of candidates) {
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
      const width = Math.max(114, Math.min(158, point.name.length * 7.3 + 28));
      const height = 48;
      // Try both sides and several heights until the label fits without overlap.
      const offsets = [
        [22, -62], [-width - 22, -62], [22, 18], [-width - 22, 18],
        [22, -110], [-width - 22, -110], [22, 65], [-width - 22, 65]
      ];
      let rect = null;
      for (const [dx, dy] of offsets) {
        const candidate = {x: point.x + dx, y: point.y + dy, width, height};
        if (withinBounds(candidate) && placed.every(p => !overlaps(p, candidate))) {
          rect = candidate;
          break;
        }
      }
      if (rect) placed.push({...rect, point});
    }
    return placed;
  }

  function bandSummaries(locations, metric, state) {
    const visible = locations.filter(p => (state === 'ALL' || p.state === state) &&
      Number.isFinite(p.latitude) && Number.isFinite(p[metric]));
    const bands = [
      {name: 'Northern locations', matches: p => p.latitude > -23},
      {name: 'Central latitudes', matches: p => p.latitude <= -23 && p.latitude > -35},
      {name: 'Southern locations', matches: p => p.latitude <= -35}
    ];
    return bands.map(b => {
      const rows = visible.filter(b.matches);
      if (!rows.length) return null;
      return {
        name: b.name, count: rows.length,
        value: rows.reduce((sum, p) => sum + p[metric], 0) / rows.length
      };
    }).filter(Boolean);
  }

  function stateCounts(locations) {
    const counts = {};
    for (const point of locations) counts[point.state] = (counts[point.state] || 0) + 1;
    return counts;
  }

  const helpers = {KEY_LOCATIONS, format, labelLayout, bandSummaries, stateCounts};
  root.NationalAnnotations = helpers;
  if (typeof module !== 'undefined' && module.exports) module.exports = helpers;
})(typeof window !== 'undefined' ? window : globalThis);
