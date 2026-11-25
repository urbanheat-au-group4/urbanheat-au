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
    const requests = [];
    page.on('request', request => {
      const file = new URL(request.url()).pathname.split('/').at(-1);
      if (['national_data.json', 'national_history.json', 'national_seasons.json'].includes(file)) requests.push(file);
    });
    await start(page);
    await page.locator('#place').selectOption('melbourne-cbd');
    await page.locator('#tab-overview').press('ArrowRight');
    assert.equal(await page.locator('#tab-historical').getAttribute('aria-selected'), 'true');
    assert.ok(await page.locator('#tab-historical').evaluate(tab => tab === document.activeElement));
    assert.ok(await page.locator('#panel-overview').isHidden());
    await page.waitForFunction(() =>
      document.querySelector('#history-summary')?.textContent?.includes('Melbourne CBD') &&
      document.querySelector('#seasons-summary')?.textContent?.includes('Melbourne CBD'));

    // The chart should show the right place, units, dates and missing years.
    assert.match(await page.locator('#history-summary').innerText(), /2015–2025/);
    assert.match(await page.locator('#history-chart').getAttribute('aria-label'), /degrees|°C/);
    assert.ok(await page.locator('#history-chart path').count() >= 2);
    assert.equal(await page.locator('#history-chart').evaluate(node => getComputedStyle(node).display), 'block');
    await page.locator('details.history-table summary').click();
    assert.match(await page.locator('#history-limits').innerText(), /2021.*left blank/);
    assert.match(await page.locator('#history-table').innerText(), /No data/);
    assert.match(await page.locator('#history-table').innerText(), /300 of 365 days/);
    assert.match(await page.locator('#history-source').innerText(), /era5/);

    // The seasonal view should show the four seasons and missing measurements.
    assert.equal(await page.locator('#seasons-chart rect').count(), 4);
    assert.notEqual(await page.locator('#seasons-chart').evaluate(node => getComputedStyle(node).display), 'none');
    await page.locator('details.seasons-years summary').click();
    assert.match(await page.locator('#seasons-table').innerText(), /No data/);
    assert.match(await page.locator('#seasons-limits').innerText(), /cannot be compared/);
    assert.match(await page.locator('#seasons-source').innerText(), /era5/);
    // One location selector changes both charts. A catalogue entry without chart data stays empty.
    await page.locator('#place').selectOption('darwin');
    assert.match(await page.locator('#history-summary').innerText(), /No historical data.*Darwin/);
    assert.match(await page.locator('#seasons-summary').innerText(), /No seasonal data.*Darwin/);
    await page.locator('#place').selectOption('sydney');
    assert.match(await page.locator('#history-summary').innerText(), /Sydney/);
    assert.match(await page.locator('#seasons-summary').innerText(), /Sydney/);
    await page.locator('#history-metric').selectOption('average_max_c');
    assert.match(await page.locator('#history-table').innerText(), /30.0/);

    // Carry the selected location and baseline across tabs, including after a swap.
    await page.locator('#baseline').selectOption('melbourne-cbd');
    await page.locator('#tab-historical').press('End');
    assert.ok(await page.locator('#panel-compare').isVisible());
    assert.match(await page.locator('#compare-table caption').innerText(), /Melbourne CBD, Sydney/);
    assert.match(await page.locator('#compare-table th').nth(1).innerText(), /Melbourne CBD.*baseline/s);
    await page.locator('#swap-locations').click();
    assert.equal(await page.locator('#place').inputValue(), 'melbourne-cbd');
    assert.equal(await page.locator('#baseline').inputValue(), 'sydney');
    assert.match(await page.locator('#compare-table caption').innerText(), /Sydney, Melbourne CBD/);
    await page.locator('#tab-compare').press('Home');
    assert.ok(await page.locator('#panel-overview').isVisible());
    assert.match(await page.locator('#detail').innerText(), /Melbourne CBD/);
    await page.locator('#tab-historical').click();
    assert.match(await page.locator('#history-summary').innerText(), /Melbourne CBD/);
    assert.match(await page.locator('#seasons-summary').innerText(), /Melbourne CBD/);
    assert.equal(await page.locator('#baseline').inputValue(), 'sydney');
    assert.deepEqual(requests.sort(), ['national_data.json', 'national_history.json', 'national_seasons.json']);

    // Check both charts still fit on a phone and the selects work by keyboard.
    await page.setViewportSize({width: 390, height: 844});
    // A real chart must use the phone width, not an 800px fallback.
    await page.waitForFunction(() => {
      const chart = document.querySelector('#history-chart');
      return chart && Number(chart.getAttribute('viewBox')?.split(' ')[2]) < 520;
    });
    assert.ok(Number((await page.locator('#seasons-chart').getAttribute('viewBox')).split(' ')[2]) < 520);
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 2, 'Charts overflow the mobile screen by ' + overflow + 'px');
    await page.close();

    // Visitors should not be told to run Python when chart data is unavailable.
    const failed = await browser.newPage();
    failed.on('pageerror', error => errors.push(error.message));
    await start(failed, true);
    await failed.locator('#tab-historical').click();
    await failed.waitForFunction(() =>
      document.querySelector('#history-summary')?.textContent?.includes('unavailable right now') &&
      document.querySelector('#seasons-summary')?.textContent?.includes('unavailable right now'));
    // Empty charts should not leave huge blank panels on the screen.
    for (const chart of ['#history-chart', '#seasons-chart']) {
      assert.equal(await failed.locator(chart).evaluate(node => getComputedStyle(node).display), 'none');
    }
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
