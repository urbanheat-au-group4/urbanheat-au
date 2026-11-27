// UHA-47: repeatable accessibility checks, not a substitute for screen-reader review.
// Runs on catalogue-only fixtures and the populated Pages build.
const { chromium } = require('@playwright/test');
const assert = require('node:assert/strict');

const URL = process.env.URBANHEAT_URL || 'http://127.0.0.1:8000/';
const EXPECT_DATA = process.env.URBANHEAT_EXPECT_DATA === '1';
const AXE_PATH = require.resolve('axe-core/axe.min.js');

async function checkTab(page, tab, width) {
  await page.locator('#tab-' + tab).click();
  if (EXPECT_DATA && tab === 'historical') {
    await page.locator('#history-chart').waitFor();
    if (width <= 390) {
      await page.locator('.history-table summary').press('Enter');
      await page.locator('.seasons-years summary').press('Enter');
      await page.locator('#history-table').focus();
      await page.keyboard.press('ArrowRight');
      await page.waitForFunction(() => document.getElementById('history-table').scrollLeft > 0);
    }
  } else if (EXPECT_DATA && tab === 'compare') {
    await page.locator('#compare-3').selectOption('sydney');
  }
  const results = await page.evaluate(async () => {
    const results = await window.axe.run({
      runOnly: {type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']}
    });
    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      violations: results.violations.map(rule => [rule.id, rule.nodes.map(node => node.target.join(' '))])
    };
  });
  assert.ok(results.overflow <= 2, `${width}px/${tab}: sideways overflow of ${results.overflow}px`);
  assert.deepEqual(results.violations, [], `${width}px/${tab}: automated accessibility violations`);
}

async function checkRepresentativeContrast(page) {
  const ratios = await page.evaluate(() => {
    const pairs = [
      ['.dashboard-heading h1', 'color', '.dashboard-heading', 'backgroundColor'],
      ['#dataset-coverage', 'color', '.dashboard-heading', 'backgroundColor'],
      ['label[for="place"]', 'color', '.control-strip', 'backgroundColor'],
      ['.heat-band span', 'color', '.heat-band', 'backgroundColor'],
      ['.callout-name', 'fill', '.callout-box', 'fill'],
      ['.callout-value', 'fill', '.callout-box', 'fill'],
      ['.callout-note', 'fill', '.callout-box', 'fill']
    ];
    function luminance(color) {
      const [r, g, b] = color.match(/[\d.]+/g).map(Number).map(channel => {
        const value = channel / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }
    return pairs.map(([foreground, fgProperty, background, bgProperty]) => {
      const light = luminance(getComputedStyle(document.querySelector(foreground))[fgProperty]);
      const dark = luminance(getComputedStyle(document.querySelector(background))[bgProperty]);
      return [foreground, (Math.max(light, dark) + 0.05) / (Math.min(light, dark) + 0.05)];
    });
  });
  for (const [selector, ratio] of ratios) {
    assert.ok(ratio >= 4.5, `${selector}: text contrast ${ratio.toFixed(2)}:1`);
  }
  console.log('Measured text contrast:', ratios.map(([selector, ratio]) => selector + ' ' + ratio.toFixed(2) + ':1').join(', '));
}

async function audit(page, width) {
  await page.setViewportSize({ width, height: 850 });
  const response = await page.goto(URL, {waitUntil: 'domcontentloaded'});
  assert.equal(response.status(), 200);
  await page.waitForFunction(() =>
    document.querySelector('#status')?.textContent?.includes('112 locations'));
  await page.addScriptTag({path: AXE_PATH});

  await page.keyboard.press('Tab');
  assert.ok(await page.locator('.skip-link').evaluate(link => document.activeElement === link));
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  assert.ok(await page.locator('#state').evaluate(select => document.activeElement === select));
  assert.equal(await page.locator('#state').evaluate(select => getComputedStyle(select).outlineStyle), 'solid');
  assert.equal(await page.locator('circle.marker[tabindex="0"]').count(), 0,
    'The national overview should not put every map marker in the Tab sequence');

  if (width <= 390) {
    for (const button of await page.locator('.control-strip select, .tab-bar button').all()) {
      assert.ok((await button.boundingBox()).height >= 44, 'Primary mobile controls need a 44px target');
    }
    await page.locator('#nav-toggle').press('Enter');
    await page.getByRole('button', {name: /NSW.*Explore New South Wales/}).press('Enter');
    assert.ok(await page.locator('#map-title').evaluate(heading => document.activeElement === heading));
    assert.equal(await page.locator('#nav-toggle').getAttribute('aria-expanded'), 'false');
  } else if (EXPECT_DATA) {
    await page.locator('#state-summary button').first().press('Enter');
    assert.ok(await page.locator('#state').evaluate(select => document.activeElement === select));
  }

  // Controls and images need names even when weather data is unavailable.
  for (const id of ['state', 'metric', 'place', 'baseline', 'history-metric', 'compare-3']) {
    const select = page.locator('#' + id);
    assert.equal(await select.count(), 1, id + ': control missing');
    const label = page.locator('label[for="' + id + '"]');
    assert.equal(await label.count(), 1, id + ': missing label');
    assert.ok((await label.textContent()).trim(), id + ': empty label');
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
  const place = page.getByRole('combobox', {name: 'Find a location', exact: true});
  for (const [index, key] of ['Enter', 'Space'].entries()) {
    const marker = page.locator('circle.marker').nth(index);
    const id = await marker.getAttribute('data-location-id');
    await marker.focus();
    await page.keyboard.press(key);
    assert.equal(await place.inputValue(), id,
      `${width}px: ${key} did not select the location`);
    assert.ok(await page.locator('#location-card').evaluate(card => card.open),
      `${width}px: ${key} did not open the location details`);
    assert.ok(await place.evaluate(select => document.activeElement === select),
      `${width}px: ${key} did not move focus to Find a location`);
  }
  assert.equal(await page.locator('#state').inputValue(), 'NSW');

  if (width <= 390) {
    const tag = page.locator('#state-location-list button').last();
    const id = await tag.getAttribute('data-location-id');
    await tag.press('Space');
    assert.equal(await place.inputValue(), id);
    assert.ok(await place.evaluate(select => document.activeElement === select));
  }
  if (EXPECT_DATA) {
    assert.match(await page.locator('#dataset-coverage').innerText(), /112 of 112/);
    await place.selectOption('tas-launceston');
    await page.locator('#baseline').selectOption('nt-timber-creek');
    if (width === 1440) await checkRepresentativeContrast(page);
  }
  for (const tab of ['overview', 'historical', 'compare']) await checkTab(page, tab, width);
}

async function main() {
  const browser = await chromium.launch({headless: true});
  try {
    const page = await browser.newPage({reducedMotion: 'reduce'});
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => { try { window.sessionStorage.clear(); } catch (error) { /* storage unavailable */ } });
    for (const width of [320, 390, 768, 1366, 1440]) {
      await audit(page, width);
    }
    assert.deepEqual(errors, [], 'Unexpected browser JS error');
    console.log('PASS UHA-47 axe checks, labels, keyboard focus and reflow across three tabs at five widths');
    console.log('PENDING manual: screen-reader and independent usability review');
  } finally {
    await browser.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
