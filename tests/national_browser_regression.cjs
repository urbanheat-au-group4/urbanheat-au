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
  vic[0].annual_mean_c = 20.5;
  vic[0].average_annual_rainfall_mm = 500;
  vic[1].annual_mean_c = 31.25;
  vic[1].average_annual_rainfall_mm = 800;
  return { data: { ...base, locations: rows }, vic };
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

    // Location selection must present the reading belonging to that ID.
    await page.locator('#place').selectOption(vic[0].id);
    assert.equal(await page.locator('#state').inputValue(), 'VIC');
    assert.match(await page.locator('#detail').innerText(), /20\.5 °C/);
    assert.match(await page.locator('.callout-tag[data-location-id="' + vic[0].id + '"] .callout-value').textContent(), /20\.5 °C/);
    assert.match(await page.locator('#state-summary').innerText(), /25\.9 °C/);
    assert.match(await page.locator('#highlights').innerText(), /Lowest[\s\S]*Highest/);

    // Changing the metric must update map, detail, range and units together.
    await page.locator('#metric').selectOption('average_annual_rainfall_mm');
    assert.match(await page.locator('#detail').innerText(), /500\.0 mm/);
    assert.equal((await page.locator('#low').innerText()).trim(), '500.0 mm');
    assert.equal((await page.locator('#high').innerText()).trim(), '800.0 mm');
    assert.match(await page.locator('.callout-tag[data-location-id="' + vic[0].id + '"] .callout-value').textContent(), /500\.0 mm/);

    // Unavailable data cannot be shown as numeric zero or a plausible reading.
    await page.locator('#place').selectOption(vic[2].id);
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
      document.querySelector('#status')?.textContent?.includes('Run python3 national_export.py first'));
    assert.equal(await unavailable.locator('circle.marker').count(), 0);
    await unavailable.close();

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
    console.log('PASS UHA-44: synthetic values, location selection, units, no-data, HTTP 503 and empty export');
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
