// I check the two charts using known test data, not made-up production readings.
const { chromium } = require('@playwright/test');
const assert = require('node:assert/strict');

const BASE = process.env.URBANHEAT_URL || 'http://127.0.0.1:8000/';

const history = {
  source: 'Open-Meteo Historical Weather API',
  model: 'era5',
  start_date: '2015-01-01',
  end_date: '2025-12-31',
  locations: [
    {
      id: 'melbourne-cbd', name: 'Melbourne CBD', state: 'VIC',
      years: [
        {year: 2020, annual_mean_c: 20, average_max_c: 27, mean_days: 366, max_days: 366, expected_days: 366},
        {year: 2021, annual_mean_c: null, average_max_c: null, mean_days: 0, max_days: 0, expected_days: 365},
        {year: 2022, annual_mean_c: 21, average_max_c: 29, mean_days: 300, max_days: 365, expected_days: 365}
      ]
    },
    {
      id: 'sydney', name: 'Sydney', state: 'NSW',
      years: [{year: 2022, annual_mean_c: 22, average_max_c: 30, mean_days: 365, max_days: 365, expected_days: 365}]
    }
  ]
};

function season(name, label, months, value) {
  const year = {
    season_year: 2025,
    period: '2024-12-01 to 2025-02-28',
    expected_days: 90, max_days: 90, min_days: 89, precip_days: 90
  };
  return {
    season: name, label, months,
    years: [year], max_years: [2025], min_years: [], precip_years: [2025],
    typical_max: value, typical_min: null, typical_precip: 100
  };
}
const seasonal = {
  source: 'Open-Meteo Historical Weather API', model: 'era5',
  start_date: '2015-01-01', end_date: '2025-12-31',
  locations: [
    { id: 'melbourne-cbd', name: 'Melbourne CBD', state: 'VIC', seasons: [
      season('summer','Summer','December to February',29),
      season('autumn','Autumn','March to May',22),
      season('winter','Winter','June to August',15),
      season('spring','Spring','September to November',24)
    ]},
    { id: 'sydney', name: 'Sydney', state: 'NSW', seasons: [
      season('summer','Summer','December to February',30)
    ]}
  ]
};

async function start(page, failed = false) {
  await page.route('**/static/national_history.json', route => route.fulfill(
    failed ? {status: 503, body: 'Unavailable'} :
      {status: 200, contentType: 'application/json', body: JSON.stringify(history)}
  ));
  await page.route('**/static/national_seasons.json', route => route.fulfill(
    failed ? {status: 503, body: 'Unavailable'} :
      {status: 200, contentType: 'application/json', body: JSON.stringify(seasonal)}
  ));
  await page.goto(BASE, {waitUntil: 'domcontentloaded'});
}

async function main() {
  const browser = await chromium.launch({headless: true});
  const errors = [];
  try {
    const page = await browser.newPage({viewport: {width: 1440, height: 900}});
    page.on('pageerror', error => errors.push(error.message));
    await start(page);
    await page.waitForFunction(() =>
      document.querySelector('#history-summary')?.textContent?.includes('Melbourne CBD') &&
      document.querySelector('#seasons-summary')?.textContent?.includes('Melbourne CBD'));

    // The chart should show the right place, units, dates and missing years.
    assert.match(await page.locator('#history-summary').innerText(), /2015–2025/);
    assert.match(await page.locator('#history-chart').getAttribute('aria-label'), /degrees|°C/);
    assert.ok(await page.locator('#history-chart path').count() >= 2);
    assert.match(await page.locator('#history-limits').innerText(), /2021.*left blank/);
    assert.match(await page.locator('#history-table').innerText(), /No data/);
    assert.match(await page.locator('#history-table').innerText(), /300 of 365 days/);
    assert.match(await page.locator('#history-source').innerText(), /era5/);

    // Change the location and measure. The chart and table must follow.
    await page.locator('#history-place').selectOption('sydney');
    assert.match(await page.locator('#history-summary').innerText(), /Sydney/);
    await page.locator('#history-metric').selectOption('average_max_c');
    assert.match(await page.locator('#history-table').innerText(), /30.0/);

    // The seasonal view should show the four seasons and missing measurements.
    assert.equal(await page.locator('#seasons-chart rect').count(), 4);
    assert.match(await page.locator('#seasons-table').innerText(), /Not enough data/);
    assert.match(await page.locator('#seasons-limits').innerText(), /cannot be compared/);
    assert.match(await page.locator('#seasons-source').innerText(), /era5/);
    await page.locator('#seasons-place').selectOption('sydney');
    assert.match(await page.locator('#seasons-summary').innerText(), /Sydney/);

    // Check both charts still fit on a phone and the selects work by keyboard.
    await page.setViewportSize({width: 390, height: 844});
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 2, 'Charts overflow the mobile screen by ' + overflow + 'px');
    await page.locator('#history-place').focus();
    await page.locator('#history-place').press('Home');
    assert.equal(await page.locator('#history-place').inputValue(), 'melbourne-cbd');
    await page.close();

    // Visitors should not be told to run Python when chart data is unavailable.
    const failed = await browser.newPage();
    failed.on('pageerror', error => errors.push(error.message));
    await start(failed, true);
    await failed.waitForFunction(() =>
      document.querySelector('#history-summary')?.textContent?.includes('unavailable right now') &&
      document.querySelector('#seasons-summary')?.textContent?.includes('unavailable right now'));
    assert.doesNotMatch(await failed.locator('#history-summary').innerText(), /python|export\.py/i);
    assert.doesNotMatch(await failed.locator('#seasons-summary').innerText(), /python|export\.py/i);
    await failed.close();

    assert.deepEqual(errors, [], 'Browser script errors');
    console.log('PASS UHA-70/88: chart values, missing years, seasons, selection, mobile and data errors');
  } finally {
    await browser.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
