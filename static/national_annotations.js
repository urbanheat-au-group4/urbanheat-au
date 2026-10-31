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

  function withinBounds(rect, view) {
    return rect.x >= view.x + 6 * view.width / 1000 && rect.y >= view.y + 6 * view.width / 1000 &&
      rect.x + rect.width <= view.x + view.width - 6 * view.width / 1000 &&
      rect.y + rect.height <= view.y + view.height - 6 * view.width / 1000;
  }

  function overlaps(a, b, gap) {
    return a.x < b.x + b.width + gap && a.x + a.width + gap > b.x &&
      a.y < b.y + b.height + gap && a.y + a.height + gap > b.y;
  }

  function stateLabelLayout(visible, metric, view) {
    // Two label columns guarantee that all state locations get a readable tag.
    // Markers stay at their real positions; lines connect them to the tags.
    const scale = view.width / 1000;
    const margin = 16 * scale;
    const valid = visible.map(p => p[metric]).filter(Number.isFinite).sort((a, b) => a-b);
    const median = valid.length ? (valid[Math.floor((valid.length-1)/2)] +
      valid[Math.floor(valid.length/2)]) / 2 : null;
    const sorted = [...visible].sort((a, b) => a.x-b.x || a.y-b.y);
    const middle = Math.ceil(sorted.length / 2);
    const columns = [sorted.slice(0, middle), sorted.slice(middle)];
    const placed = [];

    columns.forEach((column, side) => {
      const ordered = [...column].sort((a, b) => a.y-b.y || a.x-b.x);
      ordered.forEach((point, index) => {
        const width = Math.max(124, Math.min(215, point.name.length*7.3+28)) * scale;
        const height = 64 * scale;
        const x = side === 0 ? view.x+margin : view.x+view.width-margin-width;
        const y = view.y+margin +
          (index+0.5)*(view.height-2*margin)/ordered.length - height/2;
        const value = point[metric];
        const annotation = !Number.isFinite(value) || median === null ? 'No reading' :
          value > median ? 'Above state median' :
          value < median ? 'Below state median' : 'At state median';
        placed.push({point, x, y, width, height, annotation});
      });
    });
    return placed;
  }

  function labelLayout(locations, metric, state, selected, view = {x:0,y:0,width:1000,height:760}) {
    const scale = view.width / 1000;
    const visible = locations.filter(p => state === 'ALL' || p.state === state);
    if (state !== 'ALL') return stateLabelLayout(visible, metric, view);

    const candidates = visible.filter(p => KEY_LOCATIONS.includes(p.id));
    const chosen = visible.find(p => p.id === selected);
    if (chosen && !candidates.some(p => p.id === chosen.id)) candidates.unshift(chosen);
    if (chosen) candidates.sort((a,b) => Number(b.id === selected)-Number(a.id === selected));
    const placed = [];
    for (const point of candidates) {
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
      const width = Math.max(114, Math.min(158, point.name.length*7.3+28))*scale;
      const height = 48*scale;
      const offsets = [
        [20*scale,-62*scale], [-width-20*scale,-62*scale],
        [20*scale,18*scale], [-width-20*scale,18*scale],
        [20*scale,-110*scale],[-width-20*scale,-110*scale],
        [20*scale,65*scale],[-width-20*scale,65*scale]
      ];
      for (const [dx,dy] of offsets) {
        const rect = {point,x:point.x+dx,y:point.y+dy,width,height};
        if (withinBounds(rect,view) && placed.every(other=>!overlaps(other,rect,8*scale))) {
          placed.push(rect);
          break;
        }
      }
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

  function stateViewBox(locations, state, boundaryPoints = [], focusLocations = false) {
    if (state === 'ALL') return {x:0, y:0, width:1000, height:760};
    const locationsHere = locations.filter(p => p.state === state);
    const coords = [...(focusLocations ? [] : boundaryPoints), ...locationsHere.map(p => [p.x, p.y])]
      .filter(p => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]));
    if (!coords.length) return {x:0, y:0, width:1000, height:760};
    const xs = coords.map(p => p[0]), ys = coords.map(p => p[1]);
    const left = Math.min(...xs), right = Math.max(...xs);
    const top = Math.min(...ys), bottom = Math.max(...ys);
    const minimumWidth = state === 'ACT' || focusLocations ? 36 : 110;
    const width = Math.min(1000, Math.max(minimumWidth, (right-left)*1.30, (bottom-top)*1.30*1000/760));
    const height = width*760/1000;
    const x = Math.max(0, Math.min(1000-width, (left+right-width)/2));
    const y = Math.max(0, Math.min(760-height, (top+bottom-height)/2));
    return {x,y,width,height};
  }

  function hasClusteredCoverage(locations, state, boundaryPoints) {
    if (state === 'ALL' || boundaryPoints.length < 2) return false;
    const local = locations.filter(p => p.state === state);
    if (local.length < 2) return false;
    const bounds = coordinates => {
      const xs = coordinates.map(p => p[0]), ys = coordinates.map(p => p[1]);
      return [Math.max(...xs)-Math.min(...xs), Math.max(...ys)-Math.min(...ys)];
    };
    const [sampleWidth, sampleHeight] = bounds(local.map(p => [p.x,p.y]));
    const [stateWidth, stateHeight] = bounds(boundaryPoints);
    if (stateWidth <= 0 || stateHeight <= 0) return false;
    return sampleWidth/stateWidth < 0.28 && sampleHeight/stateHeight < 0.28;
  }

  function stateCounts(locations) {
    const counts = {};
    for (const point of locations) counts[point.state] = (counts[point.state] || 0) + 1;
    return counts;
  }

  const helpers = {KEY_LOCATIONS, format, labelLayout, bandSummaries, stateCounts, stateViewBox, hasClusteredCoverage};
  root.NationalAnnotations = helpers;
  if (typeof module !== 'undefined' && module.exports) module.exports = helpers;
})(typeof window !== 'undefined' ? window : globalThis);
