// UrbanHeat AU. Read the saved weather JSON and two local GeoJSON files.
const suburbSelect = document.getElementById('suburb');
const thresholdInput = document.getElementById('threshold');
const cards = document.getElementById('cards');
const map = document.getElementById('vector-map');
const SVG = 'http://www.w3.org/2000/svg';
const names = {
  MELBOURNE: 'Melbourne CBD', MELTON: 'Melton', WERRIBEE: 'Werribee',
  CRAIGIEBURN: 'Craigieburn', BELGRAVE: 'Belgrave', FRANKSTON: 'Frankston'
};
let weather = [];
let monitored = [];
let background = [];

function svg(tag, attrs = {}) {
  const node = document.createElementNS(SVG, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
}
function rings(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return geometry.coordinates;
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.flat();
  return [];
}
const cosLat = Math.cos(37.9 * Math.PI / 180);
// The map uses the same extent for both layers. Screen coordinates are SVG units.
const extent = {left: 144.45 * cosLat, right: 145.55 * cosLat, top: 37.45, bottom: 38.30};
function project([lon, lat]) {
  const availableWidth = 900, availableHeight = 480;
  const scale = Math.min(availableWidth / (extent.right - extent.left), availableHeight / (extent.bottom - extent.top));
  const xPad = (1000 - (extent.right - extent.left) * scale) / 2;
  const yPad = (580 - (extent.bottom - extent.top) * scale) / 2;
  return [xPad + (lon * cosLat - extent.left) * scale, yPad + (-lat - extent.top) * scale];
}
function pathData(geometry) {
  return rings(geometry).map(ring => ring.map((point, i) => {
    const [x, y] = project(point);
    return `${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(' ') + ' Z').join(' ');
}
// Anchor label lines to the actual projected suburb polygon, not a weather grid point.
// The bounding-box centre is simple and stable for our six small localities.
function polygonAnchor(geometry) {
  const points = rings(geometry).flat().map(project);
  if (!points.length) return null;
  const xs = points.map(point => point[0]);
  const ys = points.map(point => point[1]);
  return [(Math.min(...xs) + Math.max(...xs)) / 2,
          (Math.min(...ys) + Math.max(...ys)) / 2];
}
function colour(temp, min, max) {
  // Cold blue -> neutral cream -> hot orange, clamped to available data range.
  const fraction = max === min ? 0.5 : Math.max(0, Math.min(1, (temp - min) / (max - min)));
  const stops = [[82, 163, 195], [244, 231, 178], [221, 110, 64]];
  const half = fraction * 2, i = Math.min(1, Math.floor(half)), t = half - i;
  const rgb = stops[i].map((start, j) => Math.round(start + (stops[i + 1][j] - start) * t));
  return `rgb(${rgb.join(',')})`;
}
function showWeather() {
  const threshold = Number(thresholdInput.value);
  const chosen = suburbSelect.value;
  const rows = weather.filter(w => chosen === 'all' || w.suburb === chosen);
  cards.replaceChildren();
  for (const item of rows) {
    const card = document.createElement('article');
    const title = document.createElement('h3'); title.textContent = item.suburb;
    const temp = document.createElement('p'); temp.className = 'temperature'; temp.textContent = `${item.temperature_c.toFixed(1)} °C`;
    const details = document.createElement('p'); details.textContent = `Feels like ${item.feels_like_c.toFixed(1)} °C · Humidity ${item.humidity_pct}%`;
    const alert = document.createElement('p');
    alert.className = item.temperature_c >= threshold ? 'warning' : 'normal';
    alert.textContent = item.temperature_c >= threshold ? 'Above demo threshold' : 'Below demo threshold';
    const environment = document.createElement('p');
    const uv = Number.isFinite(item.uv_index) ? item.uv_index.toFixed(1) : 'Unavailable';
    const pm = Number.isFinite(item.pm25_ug_m3) ? item.pm25_ug_m3.toFixed(1) + ' µg/m³' : 'Unavailable';
    environment.textContent = `UV: ${uv} · PM2.5: ${pm}`;
    card.append(title, temp, details, environment, alert); cards.append(card);
  }
  document.getElementById('count').textContent = String(rows.length);
  const warmest = rows.reduce((best, row) => !best || row.temperature_c > best.temperature_c ? row : best, null);
  document.getElementById('warmest').textContent = warmest ? `${warmest.suburb}: ${warmest.temperature_c.toFixed(1)} °C` : '—';
  document.getElementById('alerts').textContent = String(rows.filter(w => w.temperature_c >= threshold).length);
  const representative = rows[0] || null;
  const fmt = (value, suffix = '') => Number.isFinite(value) ? `${value.toFixed(1)}${suffix}` : 'Unavailable';
  const metrics = {
    'metric-temp': representative ? fmt(representative.temperature_c, ' °C') : '—',
    'metric-feels': representative ? fmt(representative.feels_like_c, ' °C') : '—',
    'metric-humidity': representative && Number.isFinite(representative.humidity_pct) ? `${representative.humidity_pct}%` : '—',
    'metric-uv': representative ? fmt(representative.uv_index) : '—',
    'metric-pm25': representative ? fmt(representative.pm25_ug_m3) : '—',
  };
  for (const [id, value] of Object.entries(metrics)) document.getElementById(id).textContent = value;
  document.getElementById('selected-label').textContent = representative
    ? (chosen === 'all' ? `Showing ${representative.suburb} as the summary reference` : `Showing ${representative.suburb}`)
    : 'No data available';
  const above = rows.filter(w => w.temperature_c >= threshold).length;
  const status = document.querySelector('.status');
  status.classList.toggle('warning-state', above > 0);
  document.getElementById('alert-status').textContent = !rows.length ? 'No current readings available.'
    : !Number.isFinite(threshold) || thresholdInput.value.trim() === '' ? 'Enter a valid threshold.'
    : above ? `${above} of ${rows.length} displayed locations meet or exceed ${threshold} °C.`
    : `No displayed locations meet the ${threshold} °C demo threshold.`;
  drawMap();
}
function chooseSuburb(name) { suburbSelect.value = name; showWeather(); }

// Fixed, readable label positions. A short leader line connects each label to its suburb.
const labelOffsets = {
  'Melbourne CBD': [80, 45], Melton: [85, -30], Werribee: [-80, 38],
  Craigieburn: [85, -20], Belgrave: [-78, -35], Frankston: [-75, -35]
};
function drawMap() {
  map.replaceChildren();
  if (!monitored.length || !weather.length) return;
  const thresholds = weather.map(w => w.temperature_c);
  const min = Math.min(...thresholds), max = Math.max(...thresholds);
  const defs = svg('defs');
  const gradient = svg('linearGradient', {id: 'temp-gradient'});
  [['0%', '#52a3c3'], ['50%', '#f4e7b2'], ['100%', '#dd6e40']].forEach(([offset, fill]) => gradient.append(svg('stop', {offset, 'stop-color': fill})));
  defs.append(gradient); map.append(defs);
  const title = svg('text', {x: 25, y: 37, class: 'map-watermark'});
  title.textContent = 'MELBOURNE · LOCALITY BOUNDARIES'; map.append(title);
  const back = svg('g', {'aria-label': 'Surrounding suburbs', class: 'background-layer'});
  for (const f of background) {
    const d = pathData(f.geometry); if (!d) continue;
    back.append(svg('path', {d, class: 'background-suburb', 'fill-rule': 'evenodd'}));
  }
  map.append(back);
  const labels = svg('g', {'aria-label': 'Monitored locations'});
  for (const f of monitored) {
    const name = names[String(f.properties?.locality_name || '').toUpperCase()];
    const row = weather.find(w => w.suburb === name);
    if (!row) continue;
    const active = suburbSelect.value === 'all' || suburbSelect.value === name;
    const polygon = svg('path', {
      d: pathData(f.geometry), fill: colour(row.temperature_c, min, max),
      'fill-rule': 'evenodd', class: `monitored-suburb${active ? '' : ' faded'}`,
      tabindex: '0', role: 'button', 'aria-label': `${name}: ${row.temperature_c.toFixed(1)} degrees Celsius`
    });
    const tip = svg('title'); tip.textContent = `${name} · ${row.temperature_c.toFixed(1)} °C`;
    polygon.append(tip);
    polygon.addEventListener('click', () => chooseSuburb(name));
    polygon.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {e.preventDefault(); chooseSuburb(name);}
    });
    map.append(polygon);
    const anchor = polygonAnchor(f.geometry);
    if (!anchor) continue;
    const [dx, dy] = labelOffsets[name] || [40, -25];
    // Keep both lines of the label within the map viewBox.
    const lx = Math.max(90, Math.min(910, anchor[0] + dx));
    const ly = Math.max(42, Math.min(535, anchor[1] + dy));
    const text = svg('text', {x: lx, y: ly - 10, class: 'map-label'}); text.textContent = name;
    const value = svg('text', {x: lx, y: ly + 10, class: 'map-temp'}); value.textContent = `${row.temperature_c.toFixed(1)} °C`;
    // Connector ends on the label's nearest side, not through its text.
    const edgeX = lx - Math.sign(lx - anchor[0]) * (name.length * 4 + 8);
    const line = svg('line', {
      x1: anchor[0], y1: anchor[1], x2: edgeX, y2: ly - 8,
      class: 'label-leader'
    });
    labels.append(line, text, value);
  }
  map.append(labels);
  document.getElementById('temp-low').textContent = `${min.toFixed(1)} °C`;
  document.getElementById('temp-high').textContent = `${max.toFixed(1)} °C`;
}
async function getGeoJSON(url) {
  const response = await fetch(url, {cache: 'no-store'});
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  const body = await response.json();
  if (body.type !== 'FeatureCollection' || !Array.isArray(body.features)) throw new Error('Invalid GeoJSON collection');
  return body.features.filter(f => rings(f.geometry).length);
}
async function loadMap() {
  const status = document.getElementById('map-status');
  try {
    monitored = await getGeoJSON('/static/suburb_boundaries.geojson');
    const present = new Set(monitored.map(f => String(f.properties?.locality_name || '').toUpperCase()));
    if (Object.keys(names).some(name => !present.has(name))) throw new Error('Outdated boundary data. Run python3 fetch_boundaries.py');
  } catch (error) {status.textContent = `Map unavailable: ${error.message}`; return;}
  try {
    background = await getGeoJSON('/static/metro_context.geojson');
    status.textContent = `${background.length} surrounding localities loaded`;
  } catch (error) {
    status.textContent = 'Background unavailable; monitored suburbs still shown';
  }
  drawMap();
}
async function loadWeather() {
  const error = document.getElementById('error'); error.textContent = '';
  try {
    const response = await fetch('/weather_data.json', {cache: 'no-store'});
    if (!response.ok) throw new Error('Saved readings missing. Run python3 weather.py first.');
    const data = await response.json();
    if (!Array.isArray(data.locations) || data.locations.length !== Object.keys(names).length) throw new Error('Expected six suburb records');
    if (!data.locations.every(w => typeof w.suburb === 'string' && Number.isFinite(w.temperature_c) && Number.isFinite(w.feels_like_c) && Number.isFinite(w.humidity_pct) && Number.isFinite(w.requested_latitude) && Number.isFinite(w.requested_longitude))) throw new Error('Invalid weather records');
    if (data.locations.some(w => !Object.values(names).includes(w.suburb))) throw new Error('Outdated locations. Run python3 weather.py');
    weather = data.locations;
    const previous = suburbSelect.value;
    suburbSelect.replaceChildren(new Option('All suburbs', 'all'));
    for (const row of weather) suburbSelect.add(new Option(row.suburb, row.suburb));
    suburbSelect.value = [...suburbSelect.options].some(opt => opt.value === previous) ? previous : 'all';
    document.getElementById('updated').textContent = `Data retrieved: ${data.retrieved_at_utc || 'Unknown'} (UTC)`;
    showWeather();
  } catch (exc) {
    weather = []; cards.replaceChildren(); map.replaceChildren();
    for (const id of ['count', 'warmest', 'alerts', 'metric-temp', 'metric-feels', 'metric-humidity', 'metric-uv', 'metric-pm25']) document.getElementById(id).textContent = '—';
    document.getElementById('selected-label').textContent = 'No data available';
    document.getElementById('alert-status').textContent = 'Weather data unavailable.';
    document.querySelector('.status').classList.remove('warning-state');
    error.textContent = exc.message;
  }
}
suburbSelect.addEventListener('change', showWeather);
thresholdInput.addEventListener('input', showWeather);
document.getElementById('refresh').addEventListener('click', loadWeather);
loadMap(); loadWeather();
