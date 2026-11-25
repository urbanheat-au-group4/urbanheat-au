// UHA-44/UHA-82: compare the live local dashboard against ACTUAL saved exports.
// Requires: python3 run.py --check; python3 server.py
// Never routes responses, invents temperatures, or modifies historical data.
const {chromium} = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { openLocationCard } = require('./browser_helpers.cjs');

const ROOT = path.join(__dirname, '..');
const URL = process.env.URBANHEAT_URL || 'http://127.0.0.1:8000/';
const OUT = path.join(ROOT, 'artifacts', 'uha-44-real-browser.json');
const STATES = ['NSW','VIC','QLD','WA','SA','TAS','ACT','NT'];
const METRICS = [
  ['annual_mean_c', '°C'],
  ['annual_average_max_c', '°C'],
  ['annual_average_min_c', '°C'],
  ['average_annual_rainfall_mm', 'mm'],
  ['average_days_at_least_35c', 'days'],
  ['hottest_day_c', '°C'],
];

async function main() {
  const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'static', 'national_data.json'), 'utf8'));
  assert.equal(data.count, 112, 'No complete real-data map export: run python3 run.py --check first');
  assert.equal(data.skipped.length, 0, 'Map export has skipped real-data locations');
  assert.equal(data.model, 'era5');
  assert.equal(data.start_date, '2015-01-01');
  assert.equal(data.end_date, '2025-12-31');
  for (const row of data.locations) {
    assert.ok(Number.isFinite(row.annual_mean_c), row.id + ' missing validated climate figures');
    assert.ok(Array.isArray(row.monthly_average_max_c) &&
              row.monthly_average_max_c.length === 12 &&
              row.monthly_average_max_c.every(Number.isFinite),
              row.id + ' missing real monthly highs');
  }
  const report = {passed: false, source: URL, model: data.model,
    start_date: data.start_date, end_date: data.end_date,
    location_count: data.locations.length, states: [], problems: [],
    note: 'Actual local exports, not synthetic browser fixtures. Geographic accuracy and manual accessibility not certified.'};
  const browser = await chromium.launch({headless: true});
  try {
    const page = await browser.newPage({viewport: {width: 1440,height: 900}});
    page.on('pageerror', error => report.problems.push(error.message));
    assert.equal((await page.goto(URL, {waitUntil: 'domcontentloaded'})).status(), 200);
    await page.waitForFunction(() => document.querySelector('#status')?.textContent?.includes('112 locations'));
    assert.match(await page.locator('#source-period').innerText(),
      /ERA5.*2015-01-01 to 2025-12-31/);
    for (const state of STATES) {
      const rows = data.locations.filter(p => p.state === state);
      assert.equal(rows.length, 14, state + ' expected 14 exported locations');
      const sample = rows[0];
      await page.locator('#state').selectOption(state);
      assert.equal(await page.locator('circle.marker').count(), 14);
      assert.equal(await page.locator('.callout-tag').count(), 14);
      await page.locator('#place').selectOption(sample.id);
      await openLocationCard(page);
      assert.equal(await page.locator('#place').inputValue(), sample.id);
      const checked = [];
      for (const [field, unit] of METRICS) {
        const value = sample[field];
        assert.ok(Number.isFinite(value), sample.id + ' has no real value for ' + field);
        await page.locator('#metric').selectOption(field);
        const expected = value.toFixed(1) + ' ' + unit;
        const tag = page.locator('.callout-tag[data-location-id="' + sample.id + '"] .callout-value');
        assert.ok((await tag.textContent()).includes(expected), state + '/' + field + ': wrong map value');
        if (field !== 'hottest_day_c' || sample.hottest_day_date) {
          assert.ok((await page.locator('#detail').innerText()).includes(expected),
            state + '/' + field + ': wrong details value');
        }
        checked.push(field);
      }
      await page.locator('#metric').selectOption('annual_mean_c');
      assert.equal(await page.locator('#heat-data-warning').isVisible(), false,
        state + ': stale-data warning shown for real export');
      assert.match(await page.locator('#monthly-heat-status').innerText(),
        /average daytime maximum for each month/);
      assert.equal(await page.locator('#monthly-heat-chart circle').count(), 12,
        state + ': missing 12 monthly points');
      const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const titles = await page.locator('#monthly-heat-chart circle title').allTextContents();
      assert.deepEqual(titles, sample.monthly_average_max_c.map((value, i) =>
        monthNames[i] + ': ' + value.toFixed(1) + ' °C'),
        state + ': chart temperatures do not match real monthly export');
      const tableValues = await page.locator('#monthly-heat-values td').allTextContents();
      assert.deepEqual(tableValues, sample.monthly_average_max_c.map(value =>
        value.toFixed(1) + ' °C'),
        state + ': monthly data table does not match export');
      report.states.push({state, location: sample.id, metrics: checked, monthly_points: 12});
    }
    assert.deepEqual(report.problems, [], 'Unexpected browser JavaScript errors');
    report.passed = true;
    console.log('PASS: real data and rendered values match across eight jurisdictions');
  } catch (error) {
    report.problems.push(String(error.stack || error));
    throw error;
  } finally {
    await browser.close();
    fs.mkdirSync(path.dirname(OUT), {recursive: true});
    fs.writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n');
    console.log('Evidence: ' + OUT);
  }
}
main().catch(error => {console.error(error); process.exitCode = 1;});
