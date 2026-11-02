// Read the saved weather data and map files.

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
let weatherLoaded = false;
let refreshInFlight = false;
let lastWeatherUpdate = null;

const THRESHOLD_MIN = -10, THRESHOLD_MAX = 60;
let activeThreshold = 30;                  // the last valid threshold; matches the starting value in the HTML

// Returns a real number, or null for blank, null, undefined, text, true/false and NaN.
function validNumber(value) {
  if (typeof value === 'string') {
    if (value.trim() === '') return null;
    value = Number(value);
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (value < -50 || value > 60) return null;
  return value;
}

// Reads the threshold box. If the input is invalid, shows a message and keeps the last valid value.
function readThreshold() {
  const message = document.getElementById('threshold-message');
  const n = validNumber(thresholdInput.value);
  if (n === null || n < THRESHOLD_MIN || n > THRESHOLD_MAX) {
    if (message) message.textContent = `Enter a number from ${THRESHOLD_MIN} to ${THRESHOLD_MAX}. Using ${activeThreshold} °C for now.`;
    return activeThreshold;
  }
  activeThreshold = n;
  if (message) message.textContent = '';
  return n;
}

// The ONE place that decides a location's state: 'above', 'below' or 'unavailable'.
function classify(temp, threshold) {
  const t = validNumber(temp);
  if (t === null) return 'unavailable';
  return t >= threshold ? 'above' : 'below';
}

// Wording for each state. It says "your threshold", never "warning", so it isn't confused with official alerts.
const STATE_LABEL = {
  above: t => `▲ At or above your threshold (${t} °C)`,
  below: t => `Below your threshold (${t} °C)`,
  unavailable: () => 'No valid reading (not counted)'
};

// Formats a number to one decimal place, or 'Unavailable' for anything that isn't a real number.
function fmt(value, suffix = '') {
  const n = validNumber(value);
  return n === null ? 'Unavailable' : `${n.toFixed(1)}${suffix}`;
}

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

// Use the same map area for suburb outlines and background shapes.

let extent = {left: 144.45 * cosLat, right: 145.55 * cosLat, top: 37.45, bottom: 38.30};
function fitMapBounds(features) {
  let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
  for (const feature of features) {
    for (const [lon, lat] of rings(feature.geometry).flat()) {
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
      const x = lon * cosLat, y = -lat;
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
  }
  if (!Number.isFinite(left)) return;
  const xPad = Math.max((right - left) * 0.06, 0.01);
  const yPad = Math.max((bottom - top) * 0.06, 0.01);
  extent = {left: left - xPad, right: right + xPad, top: top - yPad, bottom: bottom + yPad};
}


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

// Start label lines from the suburb shape, not the weather coordinates.
// Use the middle of each shape's bounding box.

function polygonAnchor(geometry) {
  const points = rings(geometry).flat().map(project);
  if (!points.length) return null;
  const xs = points.map(point => point[0]);
  const ys = points.map(point => point[1]);
  return [(Math.min(...xs) + Math.max(...xs)) / 2,
          (Math.min(...ys) + Math.max(...ys)) / 2];
}
function colour(temp, min, max) {

  // Colour the suburbs from cooler blue to warmer orange.

  const fraction = max === min ? 0.5 : Math.max(0, Math.min(1, (temp - min) / (max - min)));
  const stops = [[82, 163, 195], [244, 231, 178], [221, 110, 64]];
  const half = fraction * 2, i = Math.min(1, Math.floor(half)), t = half - i;
  const rgb = stops[i].map((start, j) => Math.round(start + (stops[i + 1][j] - start) * t));
  return `rgb(${rgb.join(',')})`;
}
function showWeather() {
  const threshold = readThreshold();
  const thresholdValid = thresholdInput.value.trim() !== '' && Number.isFinite(Number(thresholdInput.value)) && Number(thresholdInput.value) >= THRESHOLD_MIN && Number(thresholdInput.value) <= THRESHOLD_MAX;
  const chosen = suburbSelect.value;
  const rows = weather.filter(w => chosen === 'all' || w.suburb === chosen);
  const stateOf = w => classify(w.temperature_c, threshold);
  const count = s => (s === 'above' && !thresholdValid) ? 0 : rows.filter(w => stateOf(w) === s).length;
  cards.replaceChildren();
  for (const item of rows) {
    const state = stateOf(item);
    const card = document.createElement('article');
    card.className = `state-${state}`;
    const title = document.createElement('h3'); title.textContent = item.suburb;
    const temp = document.createElement('p'); temp.className = 'temperature'; temp.textContent = fmt(item.temperature_c, ' °C');
    const details = document.createElement('p'); details.textContent = `Feels like ${fmt(item.feels_like_c, ' °C')} · Humidity ${Number.isFinite(item.humidity_pct) ? item.humidity_pct + '%' : 'Unavailable'}`;
    const alert = document.createElement('p');
    alert.className = state === 'above' ? 'warning' : state === 'below' ? 'normal' : 'no-data';
    alert.textContent = STATE_LABEL[state](thresholdValid ? threshold : activeThreshold);
    const environment = document.createElement('p');
    const uv = Number.isFinite(item.uv_index) ? item.uv_index.toFixed(1) : 'Unavailable';
    const pm = Number.isFinite(item.pm25_ug_m3) ? item.pm25_ug_m3.toFixed(1) + ' µg/m³' : 'Unavailable';
    environment.textContent = `UV: ${uv} · PM2.5: ${pm}`;
    card.append(title, temp, details, environment, alert); cards.append(card);
  }
  document.getElementById('count').textContent = String(rows.length);
  const warmest = rows.filter(w => validNumber(w.temperature_c) !== null).reduce((best, row) => !best || row.temperature_c > best.temperature_c ? row : best, null);
  document.getElementById('warmest').textContent = warmest ? `${warmest.suburb}: ${warmest.temperature_c.toFixed(1)} °C` : '—';
  document.getElementById('alerts').textContent = String(count('above'));
  const representative = rows[0] || null;
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
  const status = document.querySelector('.status');
  status.classList.toggle('warning-state', count('above') > 0);
  const valid = count('above') + count('below'), missing = count('unavailable');
  let msg = !rows.length ? 'No current readings available.'
    : !thresholdValid ? 'Enter a valid threshold. The previous threshold is kept.'
    : !valid ? 'No valid temperature readings to compare with your threshold.'
    : `${count('above')} of ${valid} displayed locations with valid readings are at or above your ${threshold} °C threshold.`;
  if (missing) msg += ` ${missing} with no valid reading not counted.`;
  document.getElementById('alert-status').textContent = msg;
  drawMap();
}
function chooseSuburb(name) { suburbSelect.value = name; showWeather(); }

// Set label positions and connect them to their suburbs.

const labelOffsets = {
  'Melbourne CBD': [-55, -40], Melton: [-85, -40], Werribee: [-90, 45],
  Craigieburn: [90, -30], Belgrave: [85, -40], Frankston: [65, 40]
};
function drawMap() {
  map.replaceChildren();
  if (!monitored.length || !weather.length) return;
  const threshold = activeThreshold;
  const valid = weather.map(w => validNumber(w.temperature_c)).filter(t => t !== null);
  const min = valid.length ? Math.min(...valid) : 0, max = valid.length ? Math.max(...valid) : 0;
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
    const t = validNumber(row.temperature_c), state = classify(t, threshold);
    const tText = t === null ? 'No data' : `${t.toFixed(1)} °C`;
    const sText = {above: 'at or above your threshold', below: 'below your threshold', unavailable: 'no valid reading, not counted'}[state];
    const polygon = svg('path', {
      d: pathData(f.geometry), fill: t === null ? '#aeb8be' : colour(t, min, max),
      'fill-rule': 'evenodd', class: `monitored-suburb state-${state}${active ? '' : ' faded'}`,
      tabindex: '0', role: 'button', 'aria-label': `${name}: ${tText}, ${sText}`
    });
    const tip = svg('title'); tip.textContent = `${name} · ${tText} · ${sText}`;
    polygon.append(tip);
    polygon.addEventListener('click', () => chooseSuburb(name));
    polygon.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {e.preventDefault(); chooseSuburb(name);}
    });
    map.append(polygon);
    const anchor = polygonAnchor(f.geometry);
    if (!anchor) continue;
    const [dx, dy] = labelOffsets[name] || [40, -25];
    // Keep the suburb name and temperature inside the map.
    const lx = Math.max(90, Math.min(910, anchor[0] + dx));
    const ly = Math.max(42, Math.min(535, anchor[1] + dy));
    const text = svg('text', {x: lx, y: ly - 10, class: 'map-label'}); text.textContent = name;
    const value = svg('text', {x: lx, y: ly + 10, class: 'map-temp'}); value.textContent = state === 'above' ? `▲ ${tText}` : tText;
    // Stop the line before it reaches the label text.
    const edgeX = lx - Math.sign(lx - anchor[0]) * (name.length * 4 + 8);
    const line = svg('line', {
      x1: anchor[0], y1: anchor[1], x2: edgeX, y2: ly - 8,
      class: 'label-leader'
    });
    labels.append(line, text, value);
  }
  map.append(labels);
  document.getElementById('temp-low').textContent = valid.length ? `${min.toFixed(1)} °C` : '—';
  document.getElementById('temp-high').textContent = valid.length ? `${max.toFixed(1)} °C` : '—';
}
async function getGeoJSON(url) {
  const response = await fetch(url, {cache: 'no-store'});
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  const body = await response.json();
  if (body.type !== 'FeatureCollection' || !Array.isArray(body.features)) throw new Error('Invalid GeoJSON collection');
  return body.features.filter(f => rings(f.geometry).length);
}

// Hide some distant southwest background suburbs that look detached.
// Keep all six selected suburbs visible.

function fullMetroContext(features) {
  let west = Infinity, east = -Infinity, south = Infinity, north = -Infinity;
  for (const feature of features) {
    for (const [lon, lat] of rings(feature.geometry).flat()) {
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
      west = Math.min(west, lon); east = Math.max(east, lon);
      south = Math.min(south, lat); north = Math.max(north, lat);
    }
  }
  return west < 144.6 && east > 145.5 && south < -38.2 && north > -37.5;
}

async function loadMap() {
  const status = document.getElementById('map-status');
  try {
    monitored = await getGeoJSON('/static/suburb_boundaries.geojson');
    const present = new Set(monitored.map(f => String(f.properties?.locality_name || '').toUpperCase()));
    if (Object.keys(names).some(name => !present.has(name))) throw new Error('Outdated boundary data. Run python3 fetch_boundaries.py');
  } catch (error) {status.textContent = `Map unavailable: ${error.message}`; return;}
  try {
    const fullBackground = await getGeoJSON('/static/metro_context.geojson');
    if (!fullMetroContext(fullBackground)) throw new Error('Incomplete map data. Run python3 fetch_metro_context.py');
    background = fullBackground;
    fitMapBounds(monitored);
    status.textContent = `${background.length} surrounding localities loaded`;
  } catch (error) {
    status.textContent = `Background unavailable: ${error.message}`;
  }
  drawMap();
}
async function loadWeather() {
  const error = document.getElementById('error'); error.textContent = '';
  try {
    if (refreshInFlight) return;
    refreshInFlight = true;
    const response = await fetch('/weather_data.json', {cache: 'no-store'});
    if (!response.ok) throw new Error('Saved readings missing. Run python3 weather.py first.');
    const data = await response.json();
    if (!Array.isArray(data.locations) || data.locations.length !== Object.keys(names).length) throw new Error('Expected six suburb records');
    if (!data.locations.every(w => typeof w.suburb === 'string' && Number.isFinite(w.temperature_c) && Number.isFinite(w.feels_like_c) && Number.isFinite(w.humidity_pct) && Number.isFinite(w.requested_latitude) && Number.isFinite(w.requested_longitude))) throw new Error('Invalid weather records');
    if (data.locations.some(w => !Object.values(names).includes(w.suburb))) throw new Error('Outdated locations. Run python3 weather.py');
    const updatedAt = new Date(data.retrieved_at_utc);
    if (typeof data.retrieved_at_utc !== 'string' || !Number.isFinite(updatedAt.getTime())) throw new Error('Weather update time is missing or invalid');
    // Also check when each weather reading was measured
    for (const row of data.locations) {
      if (typeof row.observed_at_gmt !== 'string') {
        throw new Error('Weather reading time is missing');
      }
      const observed = new Date(row.observed_at_gmt.endsWith('Z') ? row.observed_at_gmt : row.observed_at_gmt + 'Z');
      if (!Number.isFinite(observed.getTime())) {
        throw new Error('Weather reading time is invalid');
      }
      const readingAge = (Date.now() - observed.getTime()) / 3600000;
      if (readingAge > 3 || readingAge < -0.25) {
        throw new Error('Weather readings are out of date. Run python3 weather.py');
      }
    }
    const ageHours = (Date.now() - updatedAt.getTime()) / 3600000;
    if (ageHours > 3 || ageHours < -0.25) throw new Error('Weather data is out of date. Run python3 weather.py to refresh it');
    weather = data.locations;
    weatherLoaded = true;
    lastWeatherUpdate = updatedAt;
    const previous = suburbSelect.value;
    suburbSelect.replaceChildren(new Option('All suburbs', 'all'));
    for (const row of weather) suburbSelect.add(new Option(row.suburb, row.suburb));
    suburbSelect.value = [...suburbSelect.options].some(opt => opt.value === previous) ? previous : 'all';
    const updatedText = `Last updated: ${updatedAt.toLocaleString('en-AU', {timeZone: 'Australia/Melbourne'})} (Melbourne time)`;
    document.getElementById('updated').textContent = updatedText;
    const top = document.getElementById('updated-top');
    if (top) top.textContent = updatedText;
    const refreshStatus = document.getElementById('refresh-status');
    if (refreshStatus) refreshStatus.textContent = 'Current weather loaded successfully';
    showWeather();
  } catch (exc) {
    const refreshStatus = document.getElementById('refresh-status');
    if (refreshStatus) refreshStatus.textContent = 'Refresh unsuccessful; last validated readings retained where available';
    if (weatherLoaded) {
      error.textContent = `Refresh failed: ${exc.message}. Last validated readings are retained; check their timestamp.`;
      return;
    }
    weather = []; cards.replaceChildren(); map.replaceChildren();
    for (const id of ['count', 'warmest', 'alerts', 'metric-temp', 'metric-feels', 'metric-humidity', 'metric-uv', 'metric-pm25']) document.getElementById(id).textContent = '—';
    document.getElementById('selected-label').textContent = 'No data available';
    document.getElementById('alert-status').textContent = 'Weather data unavailable.';
    document.querySelector('.status').classList.remove('warning-state');
    const top = document.getElementById('updated-top');
    if (top) top.textContent = 'Weather data unavailable';
    document.getElementById('updated').textContent = 'No valid current readings loaded';
    error.textContent = exc.message;
  } finally {
    refreshInFlight = false;
  }
}
async function pollRefresh() {
  if (refreshInFlight) return;
  try {
    const response = await fetch('/refresh-status', {cache: 'no-store'});
    if (response.ok) {
      const status = await response.json();
      const label = document.getElementById('refresh-status');
      if (label) label.textContent = status.running ? 'Weather update running…' : status.last_error ? 'Automatic weather update failed; data may be stale' : 'Automatic weather refresh enabled';
    }
  } catch (_) { /* A static hosting preview may not provide the status endpoint */ }
  await loadWeather();
}
suburbSelect.addEventListener('change', showWeather);
thresholdInput.addEventListener('input', showWeather);
document.getElementById('refresh').addEventListener('click', loadWeather);
loadMap(); loadWeather();
// Match the default server interval; polling only reads the saved snapshot.
if (typeof setInterval === 'function') setInterval(pollRefresh, 60 * 1000);
