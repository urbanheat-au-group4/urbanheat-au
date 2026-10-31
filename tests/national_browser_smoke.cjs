// Browser acceptance tests for all eight national map layers.
// Uses the actual location catalogue, with unavailable readings instead
// of invented weather numbers. Boundary shapes come from geoBoundaries.
const {chromium} = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const url = process.env.URBANHEAT_URL || 'http://127.0.0.1:8000/';
const artifacts = path.join(__dirname, '..', 'artifacts', 'national-map');
const STATES = ['NSW','VIC','QLD','WA','SA','TAS','ACT','NT'];

async function check(condition, message) {
  if (!condition) throw new Error(message);
}

async function checkState(page, code) {
  await page.locator('#state').selectOption(code);
  await page.waitForFunction(() => document.querySelectorAll('#state-location-list button').length === 14);
  const count = await page.locator('#national-map circle.marker').count();
  assert.equal(count, 14, code + ': expected 14 markers');
  const tags = page.locator('#state-location-list button');
  assert.equal(await tags.count(), 14, code + ': expected 14 labelled readings');
  const ids = await tags.evaluateAll(nodes => nodes.map(node => node.dataset.locationId));
  assert.equal(new Set(ids).size, 14, code + ': duplicate IDs');
  const markerIds = await page.locator('circle.marker').evaluateAll(nodes => nodes.map(node => node.dataset.locationId));
  assert.deepEqual(new Set(ids), new Set(markerIds), code + ': marker IDs must match tags');
  assert.equal(await page.locator('#state-locations').isVisible(), true);
  await check((await page.locator('#map-title').innerText()).includes('State view'), code + ': no state heading');
  await check((await page.locator('#national-map').getAttribute('viewBox')) !== '0 0 1000 760',
    code + ': map did not zoom');
  const first = tags.first();
  const name = await first.locator('span').innerText();
  await first.click();
  assert.equal(await first.getAttribute('aria-pressed'), 'true', code + ': tag not selected');
  await check((await page.locator('#detail').innerText()).includes(name),
    code + ': tag did not update detail');
  const secondId = markerIds[1];
  await page.locator('circle.marker').nth(1).click();
  assert.equal(await page.locator('#place').inputValue(), secondId,
    code + ': marker selection not synchronised');
  const title = await page.locator('#state-locations-title').innerText();
  await check(title.includes('14 locations'), code + ': title is not showing 14 places');
  await page.screenshot({path: path.join(artifacts, code.toLowerCase() + '-desktop.png'), fullPage: true});
}

async function main() {
  fs.mkdirSync(artifacts, {recursive:true});
  const browser = await chromium.launch({headless:true});
  const errors = [];
  try {
    const page = await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
    page.on('pageerror', error => errors.push(error.message));
    const response = await page.goto(url, {waitUntil:'domcontentloaded'});
    assert.equal(response.status(), 200);
    await page.waitForFunction(() =>
      document.querySelector('#status')?.textContent?.includes('112 locations'), {timeout:20000});
    assert.equal(await page.locator('circle.marker').count(), 112);
    assert.equal(await page.locator('#state-locations').isVisible(), false);
    assert.ok(await page.locator('path.selectable-state').count() >= 8,
      'Official state boundary layer was not loaded');
    await page.screenshot({path:path.join(artifacts,'australia-desktop.png'),fullPage:true});

    // Clicking a real state outline must focus that state's local map.
    const outline = page.locator('path[aria-label="Zoom into New South Wales"]').first();
    await outline.focus();
    await outline.press('Enter');
    assert.equal(await page.locator('#state').inputValue(), 'NSW');
    assert.equal(await page.locator('#state-location-list button').count(), 14);
    await page.locator('#back-to-australia').click();
    assert.equal(await page.locator('#state').inputValue(), 'ALL');
    assert.equal(await page.locator('circle.marker').count(), 112);

    for (const code of STATES) await checkState(page, code);
    await page.locator('#back-to-australia').click();
    assert.equal(await page.locator('circle.marker').count(), 112);
    assert.equal(await page.locator('#state-locations').isVisible(), false);

    // Mobile must show all 14 readable tags with no horizontal page overflow.
    await page.setViewportSize({width:390,height:844});
    for (const code of ['ACT','VIC','NSW']) {
      await page.locator('#state').selectOption(code);
      assert.equal(await page.locator('#state-location-list button:visible').count(),14);
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.ok(overflow <= 2, code + ': mobile has ' + overflow + 'px horizontal overflow');
      await page.screenshot({path:path.join(artifacts, code.toLowerCase() + '-mobile.png'),fullPage:true});
    }
    assert.deepEqual(errors, [], 'Browser JavaScript errors');
    console.log('Passed: 112 national markers, eight state views, 14 tags each, keyboard, selection and mobile');
    console.log('Screenshots: ' + artifacts);
  } finally {
    await browser.close();
  }
}

main().catch(error => {console.error(error); process.exitCode = 1;});
