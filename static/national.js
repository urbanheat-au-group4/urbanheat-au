// National climate map. The Melbourne dashboard has its own files.
const svg = document.getElementById('national-map');
const state = document.getElementById('state');
const metric = document.getElementById('metric');
const place = document.getElementById('place');
const detail = document.getElementById('detail');
const back = document.getElementById('back-to-australia');
const heading = document.getElementById('map-title');
const NS = 'http://www.w3.org/2000/svg';
const labels = window.NationalAnnotations;
const FIELDS = {
  annual_mean_c: 'Average temperature',
  annual_average_max_c: 'Daytime maximum',
  annual_average_min_c: 'Nighttime minimum',
  average_annual_rainfall_mm: 'Annual rainfall',
  average_days_at_least_35c: 'Days ≥35°C per year'
};
const STATES = {
  NSW: 'New South Wales', VIC: 'Victoria', QLD: 'Queensland', WA: 'Western Australia',
  SA: 'South Australia', TAS: 'Tasmania', ACT: 'Australian Capital Territory',
  NT: 'Northern Territory'
};
let points = [];
let boundaries = [];
let selected = '';

function element(tag, attributes = {}) {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
}
function project([lon, lat]) {
  return [36 + (lon - 112) * 928 / 42.5, 36 + (-10 - lat) * 688 / 34.5];
}
function rings(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return geometry.coordinates;
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.flat();
  return [];
}
function paths(geometry) {
  return rings(geometry).map(ring => ring.map((point, index) => {
    const [x, y] = project(point);
    return (index ? 'L' : 'M') + x.toFixed(2) + ',' + y.toFixed(2);
  }).join(' ') + 'Z').join(' ');
}
function boundaryState(feature) {
  const p = feature.properties || {};
  const raw = String(p.shapeName || p.STE_NAME21 || p.name || p.NAME_1 || p.admin1Name || '')
    .trim().toLowerCase();
  return Object.keys(STATES).find(code =>
    raw === code.toLowerCase() || raw === STATES[code].toLowerCase()) || null;
}
function stateBoundaryCorners(code) {
  const corners = [];
  for (const feature of boundaries) {
    if (boundaryState(feature) !== code) continue;
    let west = Infinity, east = -Infinity, north = Infinity, south = -Infinity;
    for (const ring of rings(feature.geometry)) {
      for (const coordinate of ring) {
        if (!Array.isArray(coordinate) || !Number.isFinite(coordinate[0]) ||
            !Number.isFinite(coordinate[1])) continue;
        const [x, y] = project(coordinate);
        west = Math.min(west, x); east = Math.max(east, x);
        north = Math.min(north, y); south = Math.max(south, y);
      }
    }
    if (Number.isFinite(west)) corners.push([west, north], [east, south]);
  }
  return corners;
}
function color(value, low, high) {
  const t = low === high ? 0.5 : Math.max(0, Math.min(1, (value-low)/(high-low)));
  const stops = [[82,163,195], [244,231,178], [221,110,64]];
  const i = Math.min(1, Math.floor(t*2)), f = t*2-i;
  return 'rgb(' + stops[i].map((v,j) => Math.round(v+(stops[i+1][j]-v)*f)).join(',') + ')';
}
function stateAverages() {
  const result = {};
  for (const code of Object.keys(STATES)) {
    const rows = points.filter(p => p.state === code && Number.isFinite(p[metric.value]));
    if (rows.length) result[code] = {
      value: rows.reduce((sum, p) => sum + p[metric.value], 0) / rows.length,
      count: rows.length
    };
  }
  return result;
}
function focusState(code) {
  state.value = code;
  selected = '';
  place.value = '';
  draw();
}
function selectPoint(id) {
  selected = id;
  place.value = id;
  draw();
}
function drawBoundaries(averages, low, high, view) {
  const group = element('g', {'aria-label': 'State and territory boundaries'});
  for (const feature of boundaries) {
    const d = paths(feature.geometry);
    if (!d) continue;
    const code = boundaryState(feature);
    const avg = averages[code];
    const active = state.value === 'ALL' || state.value === code;
    const path = element('path', {
      d, 'fill-rule': 'evenodd',
      fill: avg ? color(avg.value, low, high) : '#d5e2e6',
      class: 'boundary' + (code ? ' selectable-state' : ''),
      opacity: active ? '0.83' : '0.16',
      'stroke-width': view.width / 1000 * 1.4
    });
    if (code) {
      path.setAttribute('role', 'button');
      path.setAttribute('tabindex', '0');
      path.setAttribute('aria-label', 'Zoom into ' + STATES[code]);
      const title = element('title'); title.textContent = 'Explore ' + STATES[code];
      path.append(title);
      path.addEventListener('click', () => focusState(code));
      path.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault(); focusState(code); state.focus();
        }
      });
    }
    group.append(path);
  }
  svg.append(group);
}
function drawMarkers(visible, low, high, view) {
  const scale = view.width / 1000;
  const group = element('g', {'aria-label': 'Climate locations'});
  for (const p of visible) {
    const value = p[metric.value];
    const circle = element('circle', {
      'data-location-id': p.id,
      cx: p.x, cy: p.y, r: (selected === p.id ? 9 : 5.5) * scale,
      fill: Number.isFinite(value) ? color(value, low, high) : '#9ba9b2',
      class: 'marker' + (selected === p.id ? ' selected' : ''),
      'stroke-width': 1.7 * scale,
      role: 'button', tabindex: '0',
      'aria-label': p.name + ', ' + p.state + ': ' + labels.format(value, metric.value)
    });
    const title = element('title');
    title.textContent = p.name + ' · ' + labels.format(value, metric.value);
    circle.append(title);
    circle.addEventListener('click', () => selectPoint(p.id));
    circle.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault(); selectPoint(p.id);
        place.focus();
      }
    });
    group.append(circle);
  }
  svg.append(group);
}
function drawCallouts(visible, view) {
  const scale = view.width / 1000;
  const group = element('g', {'aria-label': 'Labelled climate locations'});
  for (const rect of labels.labelLayout(visible, metric.value, state.value, selected, view)) {
    const p = rect.point, x = rect.x, y = rect.y;
    const tag = element('g', {
      class: 'callout-tag', role: 'button', tabindex: '0',
      'data-location-id': p.id,
      'aria-label': 'Show ' + p.name + ': ' + labels.format(p[metric.value], metric.value)
    });
    const nearestX = Math.min(x + rect.width, Math.max(x, p.x));
    const nearestY = Math.min(y + rect.height, Math.max(y, p.y));
    tag.append(element('line', {
      x1: p.x, y1: p.y, x2: nearestX, y2: nearestY,
      class: 'callout-line', 'stroke-width': 1.8 * scale
    }));
    tag.append(element('rect', {
      x, y, width: rect.width, height: rect.height,
      rx: 8 * scale, class: 'callout-box',
      'stroke-width': (p.id === selected ? 2.7 : 1) * scale
    }));
    const name = element('text', {
      x: x + 10*scale, y: y + 19*scale,
      class: 'callout-name', 'font-size': 13*scale
    });
    name.textContent = p.name;
    tag.append(name);
    const value = element('text', {
      x: x + 10*scale, y: y + 37*scale,
      class: 'callout-value', 'font-size': 15*scale
    });
    value.textContent = labels.format(p[metric.value], metric.value);
    tag.append(value);
    if (rect.annotation) {
      const note = element('text', {
        x: x + 10*scale, y: y + 54*scale,
        class: 'callout-note', 'font-size': 10.5*scale
      });
      note.textContent = rect.annotation;
      tag.append(note);
    }
    tag.addEventListener('click', () => selectPoint(p.id));
    tag.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault(); selectPoint(p.id);
        place.focus();
      }
    });
    group.append(tag);
  }
  svg.append(group);
}
function updateHighlights(visible) {
  const panel = document.getElementById('highlights');
  panel.replaceChildren();
  const ordered = visible.filter(p => Number.isFinite(p[metric.value]))
    .sort((a,b) => a[metric.value] - b[metric.value]);
  if (!ordered.length) return;
  for (const [label, point] of [['Lowest', ordered[0]], ['Highest', ordered[ordered.length-1]]]) {
    const card = document.createElement('div');
    const caption = document.createElement('span');
    caption.textContent = label + ' · ' + FIELDS[metric.value];
    const name = document.createElement('strong');
    name.textContent = point.name + ' (' + point.state + ')';
    const value = document.createElement('b');
    value.textContent = labels.format(point[metric.value], metric.value);
    card.append(caption, name, value);
    panel.append(card);
  }
}
function updateDetail() {
  detail.replaceChildren();
  const point = points.find(p => p.id === selected);
  if (!point) {
    detail.textContent = 'Choose any map marker or use the location selector.';
    return;
  }
  const title = document.createElement('strong');
  title.textContent = point.name + ' · ' + point.state;
  detail.append(title);
  for (const [key, name] of Object.entries(FIELDS)) {
    const row = document.createElement('div');
    row.textContent = name + ': ';
    const value = document.createElement('span');
    value.className = 'value';
    value.textContent = labels.format(point[key], key);
    row.append(value); detail.append(row);
  }
}
function updateBands() {
  const panel = document.getElementById('heat-annotations');
  panel.replaceChildren();
  const bands = labels.bandSummaries(points, metric.value, state.value);
  for (const band of bands) {
    const card = document.createElement('div');
    card.className = 'heat-band';
    const title = document.createElement('span');
    title.textContent = band.name + ' · ' + band.count + ' places';
    const value = document.createElement('strong');
    value.textContent = labels.format(band.value, metric.value);
    card.append(title, value); panel.append(card);
  }
}
function updateStateSummary(averages) {
  const summary = document.getElementById('state-summary');
  summary.replaceChildren();
  for (const [code, average] of Object.entries(averages)) {
    if (state.value !== 'ALL' && code !== state.value) continue;
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'state-summary-item';
    card.setAttribute('aria-label', 'Explore ' + STATES[code] + ', sample average ' + labels.format(average.value, metric.value));
    const name = document.createElement('strong');
    name.textContent = code;
    const value = document.createElement('span');
    value.textContent = labels.format(average.value, metric.value);
    card.append(name, value);
    card.addEventListener('click', () => focusState(code));
    summary.append(card);
  }
}
function draw() {
  if (!points.length) return;
  const view = labels.stateViewBox(points, state.value, stateBoundaryCorners(state.value));
  svg.setAttribute('viewBox', [view.x, view.y, view.width, view.height].join(' '));
  svg.replaceChildren();
  const visible = points.filter(p => state.value === 'ALL' || p.state === state.value);
  const values = points.map(p => p[metric.value]).filter(Number.isFinite);
  const low = Math.min(...values), high = Math.max(...values);
  const averages = stateAverages();
  drawBoundaries(averages, low, high, view);
  drawCallouts(visible, view);
  drawMarkers(visible, low, high, view);
  updateHighlights(visible);
  updateBands();
  updateStateSummary(averages);
  updateDetail();
  document.getElementById('low').textContent = labels.format(low, metric.value);
  document.getElementById('high').textContent = labels.format(high, metric.value);
  document.getElementById('status').textContent = state.value === 'ALL' ?
    visible.length + ' locations' : visible.length + ' locations · all labels shown';
  heading.textContent = state.value === 'ALL' ? 'Australia · National overview' : STATES[state.value] + ' · State view';
  back.hidden = state.value === 'ALL';
  svg.setAttribute('aria-label', (state.value === 'ALL' ? 'Australia' : STATES[state.value]) +
    ' interactive climate map, ' + visible.length + ' locations');
}
async function load() {
  try {
    const response = await fetch('/static/national_data.json', {cache:'no-store'});
    if (!response.ok) throw new Error('Run python3 national_export.py first');
    const data = await response.json();
    if (!Array.isArray(data.locations) || !data.locations.length) throw new Error('National data missing');
    points = data.locations;
    for (const code of Object.keys(STATES)) {
      const option = document.createElement('option');
      option.value = code;
      option.textContent = STATES[code];
      state.append(option);
    }
    for (const p of [...points].sort((a,b) => a.name.localeCompare(b.name))) {
      const option = document.createElement('option');
      option.value = p.id;
      option.textContent = p.name + ' (' + p.state + ')';
      place.append(option);
    }
    try {
      const geo = await fetch('/static/australia_states.geojson', {cache:'no-store'});
      if (geo.ok) {
        const json = await geo.json();
        if (json.type === 'FeatureCollection' && Array.isArray(json.features)) boundaries = json.features;
      }
    } catch (_error) {
      // The state selector still works if outlines are unavailable.
    }
    draw();
    if (!boundaries.length) {
      document.getElementById('status').textContent += ' · boundary download needed';
    }
  } catch (error) {
    document.getElementById('status').textContent = error.message;
  }
}
state.addEventListener('change', () => focusState(state.value));
metric.addEventListener('change', draw);
place.addEventListener('change', () => {
  selected = place.value;
  const found = points.find(p => p.id === selected);
  if (found) state.value = found.state;
  draw();
});
back.addEventListener('click', () => {focusState('ALL'); state.focus();});
load();
