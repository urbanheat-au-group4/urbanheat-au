// Tests for the location comparison calculations. No internet or extra packages needed.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const core = require('../static/compare_core.js');

function season(name, max, min, precip, years) {
  return {
    season: name, typical_max: max, typical_min: min, typical_precip: precip,
    max_years: years, min_years: years, precip_years: years
  };
}

const TEN_YEARS = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];

function place(id, name, latitude, longitude, extra = {}) {
  const point = {
    id, name, state: 'VIC', latitude, longitude,
    average_days_at_least_35c: 8.273, average_annual_rainfall_mm: 630.082
  };
  const seasons = {
    id,
    seasons: [
      season('summer', 26, 14.5, 150.4, extra.years || TEN_YEARS),
      season('winter', 14, 6.5, 160.2, extra.years || TEN_YEARS)
    ]
  };
  return core.buildRecord(Object.assign(point, extra.point || {}), seasons);
}

const melbourne = place('melbourne-cbd', 'Melbourne CBD', -37.8136, 144.9631);
const carlton = place('carlton', 'Carlton', -37.8, 144.97);
const geelong = place('geelong', 'Geelong', -38.1499, 144.3617, {
  point: { average_days_at_least_35c: 10.5, average_annual_rainfall_mm: 540.4 }
});
const sydney = place('sydney', 'Sydney', -33.8688, 151.2093);

test('buildRecord joins yearly and seasonal figures', () => {
  assert.equal(melbourne.values.summer_max_c, 26);
  assert.equal(melbourne.values.winter_min_c, 6.5);
  assert.equal(melbourne.values.hot_days, 8.273);
  assert.equal(melbourne.values.annual_rain_mm, 630.082);
  assert.equal(melbourne.values.summer_rain_mm, 150.4);
  assert.equal(melbourne.values.winter_rain_mm, 160.2);
  assert.equal(melbourne.yearsUsed.summer_max_c, 10);
});

test('buildRecord never turns missing data into zero', () => {
  const record = core.buildRecord({ id: 'x', name: 'X', state: 'VIC', latitude: 0, longitude: 0 }, null);
  Object.values(record.values).forEach(value => assert.equal(value, null));
  assert.equal(record.yearsUsed.summer_max_c, 0);
});

test('a location cannot be picked twice', () => {
  assert.deepEqual(core.uniqueIds(['a', 'b', 'a', '', 'c', 'b']), ['a', 'b', 'c']);
});

test('distance is about right', () => {
  const km = core.distanceKm(melbourne, sydney);
  assert.ok(km > 700 && km < 730, 'Melbourne to Sydney was ' + km);
  assert.equal(core.distanceKm(melbourne, melbourne), 0);
});

test('two locations show values side by side with differences from the first', () => {
  const result = core.compare([melbourne, geelong]);
  assert.equal(result.rows.length, core.MEASURES.length);
  const hot = result.rows.find(row => row.key === 'hot_days');
  assert.deepEqual(hot.values, [8.273, 10.5]);
  assert.deepEqual(hot.differences, [null, 2.2]);
  const rain = result.rows.find(row => row.key === 'annual_rain_mm');
  assert.deepEqual(rain.differences, [null, -90]);
  assert.deepEqual(result.nearby, []);
});

test('changing one location changes only its column', () => {
  const first = core.compare([melbourne, geelong]);
  const second = core.compare([melbourne, sydney]);
  const hot = key => result => result.rows.find(row => row.key === key).values;
  assert.equal(hot('hot_days')(first)[0], hot('hot_days')(second)[0]);
  assert.equal(hot('annual_rain_mm')(first)[1], 540.4);
  assert.equal(hot('annual_rain_mm')(second)[1], 630.082);
});

test('three locations are allowed and a fourth is ignored', () => {
  assert.equal(core.compare([melbourne, geelong, sydney]).records.length, 3);
  assert.equal(core.compare([melbourne, geelong, sydney, carlton]).records.length, 3);
});

test('one location is not a comparison', () => {
  const result = core.compare([melbourne]);
  assert.equal(result.rows.length, 0);
  assert.equal(result.notes[0].type, 'info');
});

test('nearby locations are flagged and no difference is shown for them', () => {
  const result = core.compare([melbourne, carlton, geelong]);
  assert.equal(result.nearby.length, 1);
  assert.equal(result.nearby[0].a, 'Melbourne CBD');
  assert.equal(result.nearby[0].b, 'Carlton');
  assert.ok(result.notes.some(note => note.type === 'nearby' && /cannot reliably tell them apart/.test(note.text)));
  result.rows.forEach(row => assert.equal(row.differences[1], null));
  const hot = result.rows.find(row => row.key === 'hot_days');
  assert.equal(hot.differences[2], 2.2);
});

test('different numbers of years are reported', () => {
  const short = place('short', 'Short Years', -35, 149, { years: TEN_YEARS.slice(0, 7) });
  const result = core.compare([melbourne, short]);
  const notes = result.notes.filter(note => note.type === 'coverage');
  assert.equal(notes.length, 1);
  assert.match(notes[0].text, /summer maximum \(Melbourne CBD: 10, Short Years: 7\)/);
});

test('different periods are reported', () => {
  const same = core.compare([melbourne, geelong], {
    dataStart: '2015-01-01', dataEnd: '2025-12-31', seasonsStart: '2015-01-01', seasonsEnd: '2025-12-31'
  });
  assert.equal(same.notes.filter(note => note.type === 'period').length, 0);
  const different = core.compare([melbourne, geelong], {
    dataStart: '2015-01-01', dataEnd: '2025-12-31', seasonsStart: '2016-01-01', seasonsEnd: '2025-12-31'
  });
  assert.equal(different.notes.filter(note => note.type === 'period').length, 1);
});

test('missing values give no difference', () => {
  const noRain = core.buildRecord({ id: 'n', name: 'N', state: 'VIC', latitude: -35, longitude: 149 }, null);
  const result = core.compare([melbourne, noRain]);
  result.rows.forEach(row => assert.equal(row.differences[1], null));
  assert.equal(result.rows[0].values[1], null);
});

test('numbers are formatted for display', () => {
  assert.equal(core.formatNumber(8.273, 1), '8.3');
  assert.equal(core.formatNumber(null, 1), null);
  assert.equal(core.formatDifference(2.2, 1, 'days'), '+2.2 days');
  assert.equal(core.formatDifference(-90, 0, 'mm'), '-90 mm');
  assert.equal(core.formatDifference(0, 1, 'days'), 'same');
  assert.equal(core.formatDifference(null, 1, 'days'), '');
});