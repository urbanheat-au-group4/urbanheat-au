// Sprint 2: show saved suburb weather records as cards and Leaflet map markers.
let weatherData = [];
const suburbSelect = document.getElementById('suburb');
const thresholdInput = document.getElementById('threshold');
const cards = document.getElementById('cards');
const error = document.getElementById('error');

// Leaflet comes from a public CDN. Show an understandable message if unavailable.
const map = typeof L === 'undefined' ? null : L.map('map').setView([-37.86, 145.02], 10);
const markers = [];
if (map) {
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);
} else {
  document.getElementById('map-status').textContent = 'Map unavailable. Internet access is needed to load Leaflet.';
}

function isValidLocation(item) {
  return typeof item.suburb === 'string' && item.suburb.length > 0 &&
    Number.isFinite(item.temperature_c) && Number.isFinite(item.feels_like_c) &&
    Number.isFinite(item.humidity_pct) && item.humidity_pct >= 0 && item.humidity_pct <= 100 &&
    Number.isFinite(item.requested_latitude) && Number.isFinite(item.requested_longitude) &&
    Math.abs(item.requested_latitude) <= 90 && Math.abs(item.requested_longitude) <= 180;
}

function showWeather() {
  const threshold = Number(thresholdInput.value);
  const chosen = suburbSelect.value;
  const visible = weatherData.filter(item => chosen === 'all' || item.suburb === chosen);
  cards.replaceChildren();
  for (const item of visible) {
    const warning = item.temperature_c >= threshold;
    const card = document.createElement('article');
    const title = document.createElement('h3');
    title.textContent = item.suburb;
    const temp = document.createElement('p');
    temp.className = 'temperature';
    temp.textContent = `${item.temperature_c.toFixed(1)} °C`;
    const details = document.createElement('p');
    details.textContent = `Feels like ${item.feels_like_c.toFixed(1)} °C · Humidity ${item.humidity_pct}%`;
    const state = document.createElement('p');
    state.className = warning ? 'warning' : 'normal';
    state.textContent = warning ? 'Above demo threshold' : 'Below demo threshold';
    card.append(title, temp, details, state);
    cards.append(card);
  }
  document.getElementById('count').textContent = String(visible.length);
  const warmest = visible.reduce((best, row) => !best || row.temperature_c > best.temperature_c ? row : best, null);
  document.getElementById('warmest').textContent = warmest ? `${warmest.suburb}: ${warmest.temperature_c.toFixed(1)} °C` : '—';
  document.getElementById('alerts').textContent = String(visible.filter(item => item.temperature_c >= threshold).length);
  updateMap(visible, threshold);
}

function updateMap(visible, threshold) {
  if (!map) return;
  for (const marker of markers) map.removeLayer(marker);
  markers.length = 0;
  for (const item of visible) {
    const hot = item.temperature_c >= threshold;
    const marker = L.circleMarker([item.requested_latitude, item.requested_longitude], {
      radius: 10, color: hot ? '#9b3d19' : '#1b607d',
      fillColor: hot ? '#f1a265' : '#80c2d5', fillOpacity: 0.8, weight: 2
    }).addTo(map);
    // Construct a popup with DOM nodes rather than interpolating data into HTML.
    const content = document.createElement('div');
    const name = document.createElement('strong');
    name.textContent = item.suburb;
    const measurement = document.createElement('p');
    measurement.textContent = `${item.temperature_c.toFixed(1)} °C · ${hot ? 'Above' : 'Below'} demo threshold`;
    content.append(name, measurement);
    marker.bindPopup(content);
    markers.push(marker);
  }
  if (markers.length > 0) {
    const bounds = L.featureGroup(markers).getBounds();
    map.fitBounds(bounds.pad(0.22), {maxZoom: 12});
  }
}

async function loadWeather() {
  error.textContent = '';
  try {
    const response = await fetch('/weather_data.json', {cache: 'no-store'});
    if (!response.ok) throw new Error('No saved weather data. Run python3 weather.py first.');
    const data = await response.json();
    if (!Array.isArray(data.locations) || data.locations.length === 0 ||
        !data.locations.every(isValidLocation)) {
      throw new Error('Invalid weather records or missing coordinates');
    }
    weatherData = data.locations;
    const selected = suburbSelect.value;
    suburbSelect.replaceChildren(new Option('All suburbs', 'all'));
    for (const item of weatherData) suburbSelect.add(new Option(item.suburb, item.suburb));
    suburbSelect.value = [...suburbSelect.options].some(opt => opt.value === selected) ? selected : 'all';
    document.getElementById('updated').textContent = `Data retrieved: ${data.retrieved_at_utc || 'Unknown'} (UTC)`;
    showWeather();
  } catch (err) {
    weatherData = [];
    cards.replaceChildren();
    updateMap([], Number(thresholdInput.value));
    document.getElementById('count').textContent = '—';
    document.getElementById('warmest').textContent = '—';
    document.getElementById('alerts').textContent = '—';
    document.getElementById('updated').textContent = 'No weather data loaded';
    error.textContent = err.message;
  }
}
suburbSelect.addEventListener('change', showWeather);
thresholdInput.addEventListener('input', showWeather);
document.getElementById('refresh').addEventListener('click', loadWeather);
loadWeather();
