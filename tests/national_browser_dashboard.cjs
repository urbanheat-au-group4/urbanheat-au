// UHA-112: browser acceptance tests for the tabbed desktop dashboard.
// Covers: no vertical scrolling on desktop, tab and baseline persistence,
// baseline changes updating every tab, "No data" for gaps, and phone/tablet layout.
// The numbers below are deliberately synthetic TEST FIXTURES, served by route
// interception. Real data files are never read for values or modified.
const { chromium } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { openTab } = require('./browser_helpers.cjs');

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
  const baseline = catalogue.locations.find(row => row.id === 'melbourne-cbd');
  assert.ok(baseline, 'Catalogue must contain melbourne-cbd (the default baseline)');
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
  const history = { ...meta, locations: [
    { id: baseline.id, name: baseline.name, state: baseline.state, years: years(0) },
    { id: selected.id, name: selected.name, state: selected.state, years: years(2) },
    { id: other.id, name: other.name, state: other.state, years: years(4) }
  ] };
  const seasons = { ...meta, locations: [
    { id: baseline.id, name: baseline.name, state: baseline.state, seasons: seasonRows(0) },
    { id: selected.id, name: selected.name, state: selected.state, seasons: seasonRows(2) },
    { id: other.id, name: other.name, state: other.state, seasons: seasonRows(4) }
  ] };
  return { baseline, selected, other, gappy,
    national: { ...catalogue, ...meta, count: 112, skipped: [], locations: rows }, history, seasons };
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
  await page.waitForFunction(() => document.querySelector('#status')?.textContent?.includes('112 locations'));
  await page.waitForFunction(() => document.querySelector('#baseline')?.options.length > 100);
  return page;
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
    // 1. Desktop: no vertical scrolling on any tab, with a place selected.
    for (const [width, height] of [[1440, 900], [1366, 768]]) {
      const page = await newPage(browser, fx, { width, height }, errors);
      await page.locator('#place').selectOption(fx.selected.id);
      for (const tab of TABS) {
        await openTab(page, tab);
        await page.waitForTimeout(400); // charts redraw after the tab opens
        const gap = await overflow(page);
        assert.deepEqual([gap.page, gap.main], [0, 0],
          `${width}x${height} ${tab}: dashboard scrolls vertically (${JSON.stringify(gap)})`);
        await page.screenshot({ path: path.join(ARTIFACTS, `${tab}-${width}x${height}.png`) });
      }
      await page.close();
    }

    // 2. ERA5 provenance is visible and no 1981-2010 normals appear anywhere.
    let page = await newPage(browser, fx, { width: 1440, height: 900 }, errors);
    assert.match(await text(page, '#era5-badge'), /ERA5.*2015.*2025/);
    for (const tab of TABS) {
      await openTab(page, tab);
      // The page may say "No 1981–2010 averages are shown", but never show them.
      const shown = (await page.locator('main').innerText()).replace(/No 1981[–-]2010 averages are shown\./g, '');
      assert.doesNotMatch(shown, /1981/, tab + ': 1981-2010 normals must not appear');
      assert.doesNotMatch(shown, /\bnormals?\b/i, tab + ': no climate-normals wording');
    }
    assert.match(await text(page, '#hc-source'), /ERA5/i, 'Historical source note missing ERA5');
    assert.match(await text(page, '#cp-source'), /ERA5/i, 'Compare source note missing ERA5');

    // 3. Tab state: keyboard moves between tabs and a refresh keeps the tab.
    await openTab(page, 'overview');
    await page.locator('#tab-overview').focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('#tab-historical').getAttribute('aria-selected'), 'true');
    assert.ok(await page.locator('#tab-historical').evaluate(node => document.activeElement === node),
      'Focus must follow the selected tab');
    await openTab(page, 'compare');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelector('#status')?.textContent?.includes('112 locations'));
    assert.equal(await page.locator('#tab-compare').getAttribute('aria-selected'), 'true',
      'Refresh must return to the last tab');
    assert.equal(await page.locator('#panel-compare').isVisible(), true);
    assert.equal(await page.locator('#panel-overview').isVisible(), false);

    // 4. Baseline: default, change updates every tab, and survives a refresh.
    await openTab(page, 'overview');
    assert.equal(await page.locator('#baseline').inputValue(), fx.baseline.id, 'Default baseline');
    await page.locator('#baseline').selectOption(fx.other.id);
    await page.locator('#place').selectOption(fx.selected.id);
    assert.ok((await text(page, '#ov-baseline-name')).includes(fx.other.name), 'Overview baseline card');
    assert.ok((await text(page, '#ov-selected-name')).includes(fx.selected.name), 'Overview selected card');
    assert.match(await text(page, '#ov-compare-body'), /19\.0 °C/, 'Overview table shows baseline mean (15+4)');
    await openTab(page, 'historical');
    assert.ok((await text(page, '#hc-baseline-name')).includes(fx.other.name), 'Historical baseline');
    assert.ok((await text(page, '#hc-selected-name')).includes(fx.selected.name), 'Historical selected');
    await openTab(page, 'compare');
    assert.ok((await text(page, '#cp-baseline-name')).includes(fx.other.name), 'Compare baseline');
    assert.ok((await text(page, '#cp-selected-name')).includes(fx.selected.name), 'Compare selected');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelector('#baseline')?.options.length > 100);
    assert.equal(await page.locator('#baseline').inputValue(), fx.other.id, 'Baseline must persist');
    await openTab(page, 'historical');
    assert.ok((await text(page, '#hc-baseline-name')).includes(fx.other.name), 'Persisted baseline in Historical');

    // 5. Swap in Compare exchanges the two locations.
    await page.locator('#place').selectOption(fx.selected.id);
    await openTab(page, 'compare');
    await page.locator('#cp-swap').click();
    assert.ok((await text(page, '#cp-selected-name')).includes(fx.other.name), 'Swap: selected');
    assert.ok((await text(page, '#cp-baseline-name')).includes(fx.selected.name), 'Swap: baseline');

    // 6. Gaps show "No data", never zero, and one missing year is left blank.
    await page.locator('#baseline').selectOption(fx.baseline.id);
    await page.locator('#place').selectOption(fx.gappy.id);
    await openTab(page, 'overview');
    for (const id of ['ov-kpi-temp', 'ov-kpi-rain', 'ov-kpi-hot']) {
      assert.equal(await text(page, '#' + id), 'No data', id + ' must say No data');
    }
    assert.match(await text(page, '#ov-monthly-status'), /No monthly data/);
    assert.match(await text(page, '#ov-compare-body'), /No data/);
    await openTab(page, 'historical');
    assert.match(await text(page, '#hc-context-body'), /No data/);
    assert.match(await text(page, '#hc-monthly-status'), /no data/i);
    await openTab(page, 'compare');
    for (const id of ['cp-temp', 'cp-rain', 'cp-heat', 'cp-extreme']) {
      assert.equal(await text(page, '#' + id), 'No data', id + ' must say No data');
    }
    assert.match(await text(page, '#cp-summary-body'), /No data/);
    assert.match(await text(page, '#cp-monthly-status'), /no data/i);
    for (const tab of TABS) {
      await openTab(page, tab);
      for (const id of tab === 'overview' ? ['ov-kpi-temp', 'ov-kpi-rain', 'ov-kpi-hot']
        : tab === 'compare' ? ['cp-temp', 'cp-rain', 'cp-heat', 'cp-extreme'] : []) {
        assert.doesNotMatch(await text(page, '#' + id), /^0(\.0)?\b/, id + ' must never show zero');
      }
    }
    // A selected location with one blank year keeps the blank visible.
    await page.locator('#place').selectOption(fx.selected.id);
    await openTab(page, 'historical');
    assert.match(await page.locator('#hc-annual-values').textContent(), /2019[\s\S]*No data/,
      'Missing year 2019 must read No data in the annual table');
    await page.close();

    // 7. Phone and tablet: no sideways scrolling on any tab, nothing clipped vertically.
    for (const [name, width, height] of [['phone', 390, 844], ['tablet', 820, 1180]]) {
      page = await newPage(browser, fx, { width, height }, errors);
      await page.locator('#place').selectOption(fx.selected.id);
      for (const tab of TABS) {
        await openTab(page, tab);
        await page.waitForTimeout(300);
        const gap = await overflow(page);
        assert.ok(gap.sideways <= 2, `${name} ${tab}: sideways overflow of ${gap.sideways}px`);
        await page.screenshot({ path: path.join(ARTIFACTS, `${tab}-${name}.png`), fullPage: true });
      }
      // The older detail bars must stay inside the screen when opened.
      await openTab(page, 'historical');
      await page.locator('#hc-legacy summary').first().click();
      await openTab(page, 'compare');
      await page.locator('#cp-legacy summary').first().click();
      const gap = await overflow(page);
      assert.ok(gap.sideways <= 2, `${name}: opened detail bars overflow by ${gap.sideways}px`);
      await page.close();
    }

    assert.deepEqual(errors, [], 'No browser JavaScript errors expected');
    console.log('PASS UHA-112: no-scroll desktop, tabs, baseline, No data, ERA5 wording, phone and tablet');
    console.log('Screenshots: ' + ARTIFACTS);
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
