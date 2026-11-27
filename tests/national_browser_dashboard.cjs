// UHA-112: browser acceptance test for the tabbed dashboard.
// Checks: no vertical scrolling on desktop, tab and baseline memory, baseline
// changing the Historical comparison, "No data" for gaps, ERA5 wording, and
// phone and tablet layout.
// The numbers below are deliberately synthetic TEST FIXTURES, served by route
// interception. The real data files are never read for values or modified.
const { chromium } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const BASE_URL = process.env.URBANHEAT_URL || 'http://127.0.0.1:8000/';
const ROOT = path.join(__dirname, '..');
const ARTIFACTS = path.join(ROOT, 'artifacts', 'dashboard');
const MONTHS = [32, 31, 29, 24, 19, 15, 14, 16, 20, 24, 28, 30];
const TABS = ['overview', 'historical', 'compare'];

// Only ids, names, states and coordinates come from the real catalogue.
function buildFixtures() {
  const catalogue = JSON.parse(fs.readFileSync(path.join(ROOT, 'static', 'national_data.json'), 'utf8'));
  assert.equal(catalogue.locations.length, 112, 'Expected the 112-location catalogue');
  const first = state => catalogue.locations.find(row => row.state === state);
  const baseline = first('VIC');
  const selected = first('NSW');
  const other = first('QLD');
  const gappy = first('TAS');

  const measures = (row, offset) => ({
    ...row,
    annual_mean_c: 15 + offset, annual_average_max_c: 20 + offset, annual_average_min_c: 10 + offset,
    average_annual_rainfall_mm: 500 + offset * 10, average_days_at_least_35c: 5 + offset,
    hottest_day_c: 40 + offset, hottest_day_date: '2020-01-04',
    hottest_10_percent_mean_c: 35 + offset, hottest_25_percent_mean_c: 31 + offset,
    hottest_50_percent_mean_c: 27 + offset,
    monthly_average_max_c: MONTHS.map(value => value + offset)
  });
  const rows = catalogue.locations.map(row => {
    if (row.id === baseline.id) return measures(row, 0);
    if (row.id === selected.id) return measures(row, 2);
    if (row.id === other.id) return measures(row, 4);
    // Everything else, including the gappy location, has no readings at all.
    return { ...row, annual_mean_c: null, annual_average_max_c: null, annual_average_min_c: null,
      average_annual_rainfall_mm: null, average_days_at_least_35c: null, hottest_day_c: null,
      hottest_10_percent_mean_c: null, monthly_average_max_c: null };
  });
  const meta = { source: 'Open-Meteo Historical Weather API', model: 'era5',
    start_date: '2015-01-01', end_date: '2025-12-31' };

  const years = offset => {
    const list = [];
    for (let year = 2015; year <= 2025; year++) {
      const missing = offset === 2 && year === 2019; // one deliberate gap
      list.push({ year, annual_mean_c: missing ? null : 15 + offset + (year - 2015) * 0.1,
        average_max_c: missing ? null : 20 + offset, mean_days: missing ? 0 : 365,
        max_days: missing ? 0 : 365, expected_days: 365 });
    }
    return list;
  };
  const seasonRows = offset => ['summer', 'autumn', 'winter', 'spring'].map((name, i) => ({
    season: name, label: name[0].toUpperCase() + name.slice(1), months: 'three months',
    years: [{ season_year: 2025, period: '2024-12-01 to 2025-02-28', expected_days: 90, max_days: 90, min_days: 90, precip_days: 90 }],
    max_years: [2025], min_years: [2025], precip_years: [2025],
    typical_max: 28 - i * 4 + offset, typical_min: name === 'winter' ? null : 12 - i + offset,
    typical_precip: 100 + i * 10
  }));
  const people = [baseline, selected, other];
  return { baseline, selected, other, gappy,
    national: { ...catalogue, ...meta, count: 112, skipped: [], locations: rows },
    history: { ...meta, locations: people.map((row, i) => ({
      id: row.id, name: row.name, state: row.state, years: years([0, 2, 4][i]) })) },
    seasons: { ...meta, locations: people.map((row, i) => ({
      id: row.id, name: row.name, state: row.state, seasons: seasonRows([0, 2, 4][i]) })) } };
}

async function openTab(page, name) {
  await page.locator('#tab-' + name).click();
  await page.locator('#panel-' + name).waitFor({ state: 'visible' });
}

async function newPage(browser, fx, viewport, errors) {
  const page = await browser.newPage({ viewport });
  page.on('pageerror', error => errors.push(error.message));
  const json = body => route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  await page.route('**/static/national_data.json', json(fx.national));
  await page.route('**/static/national_history.json', json(fx.history));
  await page.route('**/static/national_seasons.json', json(fx.seasons));
  assert.equal((await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' })).status(), 200);
  await ready(page);
  return page;
}

async function ready(page) {
  await page.waitForFunction(() => document.querySelector('#status')?.textContent?.includes('112 locations'));
  await page.waitForFunction(() => {
    const select = document.querySelector('#baseline');
    return select && !select.disabled && select.options.length > 100;
  });
}

async function overflow(page) {
  return page.evaluate(() => ({
    page: document.documentElement.scrollHeight - window.innerHeight,
    main: document.querySelector('main').scrollHeight - document.querySelector('main').clientHeight,
    sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth
  }));
}
const text = async (page, selector) => (await page.locator(selector).innerText()).replace(/\s+/g, ' ').trim();

async function main() {
  fs.mkdirSync(ARTIFACTS, { recursive: true });
  const fx = buildFixtures();
  const browser = await chromium.launch({ headless: true });
  const errors = [];
  try {
    // 1. Desktop: no vertical scrolling on any tab, with a place and baseline chosen.
    for (const [width, height] of [[1440, 900], [1366, 768]]) {
      const page = await newPage(browser, fx, { width, height }, errors);
      await page.locator('#place').selectOption(fx.selected.id);
      await page.locator('#baseline').selectOption(fx.baseline.id);
      for (const tab of TABS) {
        await openTab(page, tab);
        await page.waitForTimeout(500); // charts redraw after the tab opens
        const gap = await overflow(page);
        assert.equal(gap.page, 0, `${width}x${height} ${tab}: the page scrolls by ${gap.page}px`);
        assert.equal(gap.main, 0, `${width}x${height} ${tab}: the content area scrolls by ${gap.main}px`);
        await page.screenshot({ path: path.join(ARTIFACTS, `${tab}-${width}x${height}.png`) });
      }
      await page.close();
    }

    // 2. ERA5 provenance is visible and no 1981-2010 averages appear on any tab.
    let page = await newPage(browser, fx, { width: 1440, height: 900 }, errors);
    assert.match(await page.locator('body').innerText(), /ERA5/, 'ERA5 wording must be visible');
    for (const tab of TABS) {
      await openTab(page, tab);
      const shown = (await page.locator('#panel-' + tab).innerText())
        .replace(/No 1981[–-]2010 averages? (are|is) shown\.?/gi, '');
      assert.doesNotMatch(shown, /1981/, tab + ': 1981-2010 averages must not appear');
    }

    // 3. Tab memory: arrow keys move between tabs and a refresh keeps the tab.
    await openTab(page, 'overview');
    await page.locator('#tab-overview').focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('#tab-historical').getAttribute('aria-selected'), 'true');
    assert.ok(await page.locator('#tab-historical').evaluate(node => document.activeElement === node),
      'Focus must follow the selected tab');
    await openTab(page, 'compare');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await ready(page);
    assert.equal(await page.locator('#tab-compare').getAttribute('aria-selected'), 'true',
      'A refresh must return to the last tab');
    assert.equal(await page.locator('#panel-compare').isVisible(), true);
    assert.equal(await page.locator('#panel-overview').isVisible(), false);

    // 4. Baseline: choosing one updates Historical, and it survives a refresh.
    await page.locator('#place').selectOption(fx.selected.id);
    await page.locator('#baseline').selectOption(fx.other.id);
    await openTab(page, 'historical');
    const historical = await text(page, '#panel-historical');
    assert.ok(historical.includes(fx.other.name), 'Historical must show the baseline ' + fx.other.name);
    assert.ok(historical.includes(fx.selected.name), 'Historical must show the selected ' + fx.selected.name);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await ready(page);
    assert.equal(await page.locator('#baseline').inputValue(), fx.other.id, 'The baseline must persist');
    await page.locator('#place').selectOption(fx.selected.id);
    await openTab(page, 'historical');
    assert.ok((await text(page, '#panel-historical')).includes(fx.other.name), 'Persisted baseline in Historical');

    // 5. Gaps show "No data", never zero.
    await page.locator('#baseline').selectOption(fx.baseline.id);
    await page.locator('#place').selectOption(fx.gappy.id);
    await openTab(page, 'historical');
    const quick = await text(page, '#historical-quick-table');
    assert.match(quick, /No data/, 'A location with no readings must say No data');
    assert.doesNotMatch(quick, /(^|\s)0(\.0)? ?(°C|mm|days)/, 'A missing value must never show as zero');
    await page.close();

    // 6. Phone and tablet: no sideways scrolling on any tab.
    for (const [name, width, height] of [['phone', 390, 844], ['tablet', 820, 1180]]) {
      page = await newPage(browser, fx, { width, height }, errors);
      await page.locator('#place').selectOption(fx.selected.id);
      await page.locator('#baseline').selectOption(fx.baseline.id);
      for (const tab of TABS) {
        await openTab(page, tab);
        await page.waitForTimeout(400);
        const gap = await overflow(page);
        assert.ok(gap.sideways <= 2, `${name} ${tab}: sideways overflow of ${gap.sideways}px`);
        await page.screenshot({ path: path.join(ARTIFACTS, `${tab}-${name}.png`), fullPage: true });
      }
      await page.close();
    }

    assert.deepEqual(errors, [], 'No browser JavaScript errors expected');
    console.log('PASS UHA-112: no-scroll desktop, tab and baseline memory, No data, ERA5 wording, phone and tablet');
    console.log('Screenshots: ' + ARTIFACTS);
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
