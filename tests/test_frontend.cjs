// Simple dashboard tests. No internet or extra packages needed
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const app = fs.readFileSync('static/app.js', 'utf8');
const suburbs = ['Melbourne CBD', 'Melton', 'Werribee', 'Craigieburn', 'Belgrave', 'Frankston'];

function freshData() {
  return {
    retrieved_at_utc: new Date().toISOString(),
    locations: suburbs.map((suburb, i) => ({
      suburb, temperature_c: 20 + i, feels_like_c: 21 + i,
      humidity_pct: 50, requested_latitude: -37.8, requested_longitude: 145,
      observed_at_gmt: new Date().toISOString(),
    })),
  };
}

async function runDashboard(data, threshold = '30') {
  const elements = {};
  function element(id = '') {
    return {
      id, textContent: '', value: '', options: [], children: [],
      classList: {add() {}, remove() {}, toggle() {}},
      setAttribute() {}, addEventListener() {},
      replaceChildren(...items) {
        this.children = items;
        if (this.id === 'suburb') this.options = items;
      },
      append(...items) { this.children.push(...items); },
      add(option) { this.options.push(option); },
    };
  }
  const get = id => elements[id] ?? (elements[id] = element(id));
  get('suburb').value = 'all';
  get('threshold').value = threshold;
  const document = {
    getElementById: get,
    querySelector: () => get('status'),
    createElement: () => element(),
    createElementNS: () => element(),
  };
  const sandbox = {
    document,
    Option: function(label, value) { this.label = label; this.value = value; },
    Date, Number, Math, String, Object, Array, Set, Error,
    fetch: async url => {
      if (url !== '/weather_data.json') throw new Error('Map not available in this test');
      if (data instanceof Error) throw data;
      return {ok: true, json: async () => data};
    },
  };
  vm.runInNewContext(app, sandbox);
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
  return get;
}

test('valid readings show six locations and no false alerts', async () => {
  const get = await runDashboard(freshData());
  assert.equal(get('count').textContent, '6');
  assert.equal(get('alerts').textContent, '0');
  assert.equal(get('error').textContent, '');
});

test('blank threshold cannot create alerts', async () => {
  const get = await runDashboard(freshData(), '');
  assert.equal(get('alerts').textContent, '0');
  assert.match(get('alert-status').textContent, /valid threshold/);
});

test('missing observation time makes readings unavailable', async () => {
  const data = freshData();
  delete data.locations[0].observed_at_gmt;
  const get = await runDashboard(data);
  assert.equal(get('alerts').textContent, '—');
  assert.match(get('error').textContent, /time is missing/);
});

test('outdated weather readings cannot trigger alerts', async () => {
  const data = freshData();
  data.locations[0].observed_at_gmt = '2020-01-01T00:00';
  const get = await runDashboard(data, '10');
  assert.equal(get('alerts').textContent, '—');
  assert.match(get('error').textContent, /out of date/);
});

test('invalid temperature cannot trigger alerts', async () => {
  const data = freshData();
  data.locations[0].temperature_c = '99';
  const get = await runDashboard(data, '10');
  assert.equal(get('alerts').textContent, '—');
  assert.match(get('error').textContent, /Invalid weather records/);
});

test('network error shows an unavailable-data message', async () => {
  const get = await runDashboard(new Error('Network unavailable'));
  assert.equal(get('alert-status').textContent, 'Weather data unavailable.');
  assert.equal(get('alerts').textContent, '—');
});
