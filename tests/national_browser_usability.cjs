// UHA-104/105: check phone/tablet/desktop layouts and keyboard use.
const {chromium} = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const URL = process.env.URBANHEAT_URL || 'http://127.0.0.1:8000/';
const OUT = path.join(__dirname, '..', 'artifacts', 'national-map');

async function noOverflow(page, size) {
  const layout = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    controls: ['#state', '#metric', '#place'].every(id => {
      const rect = document.querySelector(id).getBoundingClientRect();
      return rect.left >= -2 && rect.right <= innerWidth + 2;
    })
  }));
  assert.ok(layout.document <= 2, size + ': horizontal overflow: ' + layout.document);
  assert.ok(layout.controls, size + ': a dropdown is cut off');
}

async function main() {
  fs.mkdirSync(OUT, {recursive: true});
  const browser = await chromium.launch({headless: true});
  const errors = [];
  try {
    const page = await browser.newPage({viewport: {width:1440,height:900}});
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(URL, {waitUntil:'domcontentloaded'});
    await page.waitForFunction(() => document.querySelector('#status')?.textContent?.includes('112 locations'));

    // The same controls must work on desktop, tablet and phone.
    for (const width of [1440, 768, 390]) {
      await page.setViewportSize({width, height:900});
      await page.locator('#state').selectOption('VIC');
      assert.equal(await page.locator('circle.marker').count(), 14);
      await page.locator('#place').selectOption('melbourne-cbd');
      assert.equal(await page.locator('#state').inputValue(), 'VIC');
      assert.equal(await page.locator('#location-card').getAttribute('open'), '');
      assert.match(await page.locator('#detail').innerText(), /Melbourne CBD/);
      await noOverflow(page, width);
      await page.screenshot({path:path.join(OUT, 'dashboard-' + width + '-ui.png'), fullPage:true});
    }

    // Map markers can be selected by keyboard, and the focus is visible.
    await page.setViewportSize({width:768,height:900});
    const marker = page.locator('circle.marker').first();
    const id = await marker.getAttribute('data-location-id');
    await marker.focus();
    assert.equal(await marker.evaluate(n => document.activeElement === n), true);
    await marker.press('Enter');
    assert.equal(await page.locator('#place').inputValue(), id);
    assert.equal(await page.locator('#location-card').getAttribute('open'), '');

    // Inputs and expandable sections must be labelled and show keyboard focus.
    for (const [id, label] of [['state','State or territory'],
                                ['metric','Climate measure'],
                                ['place','Find a location']]) {
      assert.equal(await page.locator('label[for="' + id + '"]').count(), 1, label);
      const control = page.locator('#' + id);
      await control.focus();
      const style = await control.evaluate(n => getComputedStyle(n).outlineStyle);
      assert.notEqual(style, 'none', label + ': no visible focus outline');
    }
    await page.locator('#location-card summary').focus();
    assert.notEqual(await page.locator('#location-card summary')
      .evaluate(n => getComputedStyle(n).outlineStyle), 'none');

    // On phone, the navigation menu must work with Enter and Escape.
    await page.setViewportSize({width:390,height:844});
    const menu = page.locator('#nav-toggle');
    await menu.focus();
    await menu.press('Enter');
    assert.equal(await menu.getAttribute('aria-expanded'), 'true');
    await page.keyboard.press('Escape');
    assert.equal(await menu.getAttribute('aria-expanded'), 'false');
    assert.equal(await menu.evaluate(n => document.activeElement === n), true);
    await noOverflow(page, 'phone with menu closed');

    // No-data messages should be clear and not show made-up temperatures.
    assert.match(await page.locator('#detail').innerText(), /No data/);

    const failed = await browser.newPage();
    failed.on('pageerror', error => errors.push(error.message));
    await failed.route('**/static/national_data.json', route =>
      route.fulfill({status:503,body:'Unavailable'}));
    await failed.goto(URL, {waitUntil:'domcontentloaded'});
    await failed.waitForFunction(() =>
      document.querySelector('#status')?.textContent?.includes('temporarily unavailable'));
    assert.equal(await failed.locator('circle.marker').count(), 0);
    await failed.close();

    assert.deepEqual(errors, [], 'Browser JavaScript errors');
    console.log('PASS UHA-104/105: 390/768/1440px, keyboard, mobile menu, and missing data');
  } finally {
    await browser.close();
  }
}

main().catch(error => {console.error(error); process.exitCode = 1;});
