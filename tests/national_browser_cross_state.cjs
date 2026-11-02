// UHA-44: numeric climate rendering across all eight Australian jurisdictions.
// Dataset is a synthetic browser-only fixture. Production snapshots stay untouched.
const { chromium } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const URL = process.env.URBANHEAT_URL || 'http://127.0.0.1:8000/';
const ROOT = path.join(__dirname, '..');
const CODES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];
const METRICS = [
  ['annual_mean_c', '°C', i => [12 + i, 20 + i], i => 16 + i],
  ['annual_average_max_c', '°C', i => [17 + i, 25 + i], i => 21 + i],
  ['annual_average_min_c', '°C', i => [7 + i, 15 + i], i => 11 + i],
  ['average_annual_rainfall_mm', 'mm', i => [400 + i * 20, 600 + i * 20], i => 500 + i * 20],
  ['average_days_at_least_35c', 'days', i => [3 + i, 7 + i], i => 5 + i]
];

function buildFixture() {
  const source = JSON.parse(fs.readFileSync(path.join(ROOT, 'static', 'national_data.json'), 'utf8'));
  assert.equal(source.locations.length, 112);
  const rows = source.locations.map(entry => ({ ...entry }));
  const sample = new Map();
  CODES.forEach((code, i) => {
    const locations = rows.filter(item => item.state === code);
    assert.equal(locations.length, 14, code + ' must contain 14 catalogue locations');
    const pair = locations.slice(0, 2);
    for (const [metric, , values] of METRICS) {
      const [first, second] = values(i);
      pair[0][metric] = first;
      pair[1][metric] = second;
    }
    sample.set(code, locations);
  });
  return { payload: { ...source, locations: rows }, sample };
}

async function main() {
  const { payload, sample } = buildFixture();
  const browser = await chromium.launch({ headless: true });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    page.on('pageerror', err => errors.push(err.message));
    await page.route('**/static/national_data.json', route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(payload)
    }));
    const response = await page.goto(URL, { waitUntil: 'domcontentloaded' });
    assert.equal(response.status(), 200);
    await page.waitForFunction(() => document.querySelector('#status')?.textContent?.includes('112 locations'));

    for (const [i, code] of CODES.entries()) {
      await page.locator('#state').selectOption(code);
      assert.equal(await page.locator('circle.marker').count(), 14);
      assert.equal(await page.locator('.callout-tag').count(), 14);
      const locations = sample.get(code);
      const first = locations[0], second = locations[1], missing = locations[2];

      for (const [metric, units, values, mean] of METRICS) {
        await page.locator('#metric').selectOption(metric);
        await page.locator('#place').selectOption(first.id);
        assert.equal(await page.locator('#place').inputValue(), first.id);
        assert.equal(await page.locator('#state').inputValue(), code);
        const firstText = values(i)[0].toFixed(1) + ' ' + units;
        const secondText = values(i)[1].toFixed(1) + ' ' + units;
        const averageText = mean(i).toFixed(1) + ' ' + units;
        assert.ok((await page.locator('#detail').innerText()).includes(firstText),
          code + '/' + metric + ': wrong selected-location detail');
        assert.ok((await page.locator('.callout-tag[data-location-id="' + first.id + '"] .callout-value').innerText()).includes(firstText),
          code + '/' + metric + ': wrong map tag');
        assert.ok((await page.locator('.callout-tag[data-location-id="' + second.id + '"] .callout-value').innerText()).includes(secondText),
          code + '/' + metric + ': wrong second map tag');
        assert.ok((await page.locator('#state-summary').innerText()).includes(averageText),
          code + '/' + metric + ': wrong state sample average');
        const highlights = await page.locator('#highlights').innerText();
        assert.ok(highlights.includes(firstText) && highlights.includes(secondText),
          code + '/' + metric + ': low/high comparison out of sync');
        assert.ok((await page.locator('.callout-tag[data-location-id="' + missing.id + '"] .callout-value').innerText()).includes('No data'),
          code + '/' + metric + ': missing value presented as a numeric reading');
      }

      // A global location selection must change state and keep one selected ID.
      await page.locator('#back-to-australia').click();
      await page.locator('#place').selectOption(second.id);
      assert.equal(await page.locator('#state').inputValue(), code);
      assert.equal(await page.locator('#place').inputValue(), second.id);
      assert.ok((await page.locator('#detail').innerText()).includes(second.name));
    }

    assert.deepEqual(errors, [], 'No JavaScript exceptions expected');
    console.log('PASS UHA-44: 8 states × 5 numeric metrics; state sample means, tags, selectors and null values');
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
