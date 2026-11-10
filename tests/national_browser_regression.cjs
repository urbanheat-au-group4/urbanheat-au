// UHA-44: browser regression for values, selection and error states.
// The numeric readings below are deliberately synthetic TEST FIXTURES.
// Production climate data and the saved historical snapshots are never modified.
const { chromium } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const BASE_URL = process.env.URBANHEAT_URL || 'http://127.0.0.1:8000/';
const DATASET = path.join(__dirname, '..', 'static', 'national_data.json');

function fixture() {
  const base = JSON.parse(fs.readFileSync(DATASET, 'utf8'));
  assert.equal(base.locations.length, 112, 'Expected prepared 112-location fixture');
  const rows = base.locations.map(row => ({ ...row }));
  const vic = rows.filter(row => row.state === 'VIC');
  assert.equal(vic.length, 14, 'Victoria must have 14 locations');

  // Only two locations receive artificial measurements; the other 110
  // deliberately stay unavailable to exercise missing-data rendering.
  // These numbers are browser test fixtures, not actual weather readings.
  vic[0].hottest_day_c = 44.5;
  vic[0].hottest_day_date = '2020-01-04';
  vic[0].hottest_10_percent_mean_c = 38.5;
  vic[0].hottest_25_percent_mean_c = 34.5;
  vic[0].hottest_50_percent_mean_c = 29.5;
  vic[0].monthly_average_max_c = [32,31,29,24,19,15,14,16,20,24,28,30];
  vic[1].monthly_average_max_c = [33,32,30,25,20,16,15,17,21,25,29,31];
  vic[0].annual_mean_c = 20.5;
  vic[0].average_annual_rainfall_mm = 500;
  vic[1].annual_mean_c = 31.25;
  vic[1].average_annual_rainfall_mm = 800;
  return { data: {
    ...base, source: 'Open-Meteo Historical Weather API',
    model: 'era5', start_date: '2015-01-01', end_date: '2025-12-31',
    locations: rows
  }, vic };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const uncaught = [];
  try {
    const { data, vic } = fixture();
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('pageerror', error => uncaught.push(error.message));

    await page.route('**/static/national_data.json', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(data)
      });
    });
    assert.equal((await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' })).status(), 200);
    await page.waitForFunction(() => document.querySelector('#status')?.textContent?.includes('112 locations'));
    assert.equal(await page.locator('circle.marker').count(), 112);
    assert.match(await page.locator('#dataset-info').innerText(),
      /Open-Meteo Historical Weather API.*ERA5.*2015-01-01 to 2025-12-31/);
    assert.match(await page.locator('#source-period').innerText(),
      /ERA5.*2015-01-01 to 2025-12-31/);


    // Quick comparison should explain when a measure has no readings.
    await page.locator('#metric').selectOption('annual_average_min_c');
    assert.match(await page.locator('#highlights').innerText(), /No climate measurements/);
    await page.locator('#metric').selectOption('annual_mean_c');

    // Location selection must present the reading belonging to that ID.
    await page.locator('#place').selectOption(vic[0].id);
    assert.equal(await page.locator('#state').inputValue(), 'VIC');
    assert.match(await page.locator('#detail').innerText(), /20\.5 °C/);
    assert.match(await page.locator('.callout-tag[data-location-id="' + vic[0].id + '"] .callout-value').textContent(), /20\.5 °C/);
    assert.match(await page.locator('#detail').innerText(), /Hottest modelled day: 44\.5 °C/);
    assert.match(await page.locator('#detail').innerText(), /hottest 10% of days: 38\.5 °C/);
    assert.equal(await page.locator('#monthly-heat-chart circle').count(), 12);
    assert.match(await page.locator('#monthly-heat-values').innerText(), /32\.0 °C/);
    assert.match(await page.locator('#state-summary').innerText(), /25\.9 °C/);
    assert.doesNotMatch(await page.locator('#highlights').innerText(), /No climate measurements/);
    assert.match(await page.locator('#highlights').innerText(), /Lowest[\s\S]*Highest/);

    // Changing the metric must update map, detail, range and units together.
    await page.locator('#metric').selectOption('average_annual_rainfall_mm');
    assert.match(await page.locator('#detail').innerText(), /500\.0 mm/);
    assert.equal((await page.locator('#low').innerText()).trim(), '500.0 mm');
    assert.equal((await page.locator('#high').innerText()).trim(), '800.0 mm');
    assert.match(await page.locator('.callout-tag[data-location-id="' + vic[0].id + '"] .callout-value').textContent(), /500\.0 mm/);

    // Unavailable data cannot be shown as numeric zero or a plausible reading.
    await page.locator('#place').selectOption(vic[1].id);
    assert.match(await page.locator('#monthly-heat-values').innerText(), /33\.0 °C/);
    await page.locator('#place').selectOption(vic[2].id);
    assert.equal(await page.locator('#monthly-heat-chart').isVisible(), false);
    assert.match(await page.locator('#monthly-heat-status').innerText(), /not available/);
    assert.match(await page.locator('#detail').innerText(), /No data/);
    assert.equal(await page.locator('circle.marker[data-location-id="' + vic[2].id + '"]').getAttribute('fill'), '#9ba9b2');
    assert.match(await page.locator('.callout-tag[data-location-id="' + vic[2].id + '"] .callout-value').textContent(), /No data/);

    await page.locator('#back-to-australia').click();
    assert.equal(await page.locator('#state').inputValue(), 'ALL');
    assert.equal(await page.locator('circle.marker').count(), 112);
    await page.close();

    // Failure to fetch data must be visible rather than producing a blank,
    // apparently successful chart.
    const unavailable = await browser.newPage();
    unavailable.on('pageerror', error => uncaught.push(error.message));
    await unavailable.route('**/static/national_data.json', route =>
      route.fulfill({ status: 503, body: 'Unavailable' }));
    await unavailable.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await unavailable.waitForFunction(() =>
      document.querySelector('#status')?.textContent?.includes('temporarily unavailable'));
    assert.equal(await unavailable.locator('circle.marker').count(), 0);
    await unavailable.close();
    // A missing file and a network error need their own messages.
    const missing = await browser.newPage();
    await missing.route('**/static/national_data.json', route =>
      route.fulfill({ status: 404, body: 'Not Found' }));
    await missing.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await missing.waitForFunction(() =>
      document.querySelector('#status')?.textContent?.includes('has not been added yet'));
    assert.equal(await missing.locator('circle.marker').count(), 0);
    await missing.close();

    const offline = await browser.newPage();
    await offline.route('**/static/national_data.json', route => route.abort('failed'));
    await offline.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await offline.waitForFunction(() =>
      document.querySelector('#status')?.textContent?.includes('Could not connect'));
    assert.equal(await offline.locator('circle.marker').count(), 0);
    await offline.close();




    const empty = await browser.newPage();
    empty.on('pageerror', error => uncaught.push(error.message));
    await empty.route('**/static/national_data.json', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{"locations":[]}' }));
    await empty.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await empty.waitForFunction(() =>
      document.querySelector('#status')?.textContent?.includes('National data missing'));
    assert.equal(await empty.locator('circle.marker').count(), 0);
    await empty.close();

    assert.deepEqual(uncaught, [], 'No browser JavaScript exceptions expected');
    console.log('PASS combined: metadata, location values, no-data, HTTP and network errors');
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
