// UHA-47: repeatable accessibility checks, not a substitute for screen-reader review.
// Uses catalogue-only missing-weather fixtures. No production UI files are changed.
const { chromium } = require('@playwright/test');
const assert = require('node:assert/strict');

const URL = process.env.URBANHEAT_URL || 'http://127.0.0.1:8000/';

async function audit(page, width) {
  await page.setViewportSize({ width, height: 850 });
  const response = await page.goto(URL, {waitUntil: 'domcontentloaded'});
  assert.equal(response.status(), 200);
  await page.waitForFunction(() =>
    document.querySelector('#status')?.textContent?.includes('112 locations'));

  // Controls and images need names even when weather data is unavailable.
  for (const id of ['state', 'metric', 'place', 'history-place',
                    'history-metric', 'seasons-place', 'compare-1',
                    'compare-2', 'compare-3']) {
    const select = page.locator('#' + id);
    assert.equal(await select.count(), 1, id + ': control missing');
    const label = page.locator('label[for="' + id + '"]');
    assert.equal(await label.count(), 1, id + ': missing label');
    assert.ok((await label.innerText()).trim(), id + ': empty label');
  }
  const logo = page.locator('.brand-home img');
  assert.ok((await logo.getAttribute('alt'))?.trim(), 'Home logo missing alt text');

  for (const id of ['status', 'heat-data-warning',
                    'monthly-heat-status', 'history-summary',
                    'seasons-summary', 'compare-status']) {
    assert.equal(await page.locator('#' + id).getAttribute('role'), 'status',
      id + ': missing status semantics');
  }

  const map = page.locator('#national-map');
  assert.ok((await map.getAttribute('aria-label'))?.includes('map'),
    'Map has no accessible label');

  // Keyboard users must be able to operate state selection and a location.
  await page.locator('#state').focus();
  await page.locator('#state').selectOption('NSW');
  await page.waitForFunction(() => document.querySelectorAll('circle.marker').length === 14);
  const marker = page.locator('circle.marker').first();
  const id = await marker.getAttribute('data-location-id');
  await marker.focus();
  await marker.press('Enter');
  assert.equal(await page.locator('#place').inputValue(), id,
    'Keyboard marker action did not select the location');
  assert.equal(await page.locator('#state').inputValue(), 'NSW');

  // Core content must fit a phone without sideways scrolling.
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 2, width + 'px: sideways overflow of ' + overflow + 'px');

  // A browser test can confirm focus, but not whether a screen reader announces it well.
  assert.equal(await marker.evaluate(el => document.activeElement === el), true,
    'Keyboard focus was lost after selecting a marker');
}

async function main() {
  const browser = await chromium.launch({headless: true});
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    for (const width of [390, 768, 1440]) {
      await audit(page, width);
    }
    assert.deepEqual(errors, [], 'Unexpected browser JS error');
    console.log('PASS UHA-47 automated labels, status semantics, keyboard map and viewport checks');
    console.log('PENDING manual: NVDA/VoiceOver, focus-order, contrast and human readability');
  } finally {
    await browser.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
