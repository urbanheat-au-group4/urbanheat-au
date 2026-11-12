// Verify annotations for zoomed state maps without fabricating production readings.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const A = require('../static/national_annotations.js');

const catalogue = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'locations.json'), 'utf8'
)).locations.filter(p => p.groups.includes('australia_historical'));
const points = catalogue.map(p => ({
  ...p,
  x: 36 + (p.longitude - 112) * 928 / 42.5,
  y: 36 + (-10 - p.latitude) * 688 / 34.5,
  annual_mean_c: null
}));

assert.equal(A.medianAnnotation(26, 24, 'annual_mean_c'), '+2.0 °C vs state median');
assert.equal(A.medianAnnotation(22, 24, 'annual_mean_c'), '−2.0 °C vs state median');
assert.equal(A.medianAnnotation(24, 24, 'annual_mean_c'), 'At state median');
assert.equal(A.medianAnnotation(null, 24, 'annual_mean_c'), 'No data');
assert.equal(A.medianAnnotation(710, 700, 'average_annual_rainfall_mm'), '+10.0 mm vs state median');
assert.equal(A.medianAnnotation(13, 11, 'average_days_at_least_35c'), '+2.0 days vs state median');

for (const code of ['NSW','VIC','QLD','WA','SA','TAS','ACT','NT']) {
  const rows = points.filter(p => p.state === code);
  assert.equal(rows.length, 14);
  rows[0].annual_mean_c = 20;
  rows[1].annual_mean_c = 30;
  const view = A.stateViewBox(points, code);
  const tags = A.labelLayout(points, 'annual_mean_c', code, '', view);
  assert.equal(tags.length, 14, code + ': all tags must automatically appear');
  assert.equal(new Set(tags.map(t => t.point.id)).size, 14, code + ': unique location IDs');
  assert.ok(tags.some(t => t.annotation === '−5.0 °C vs state median'), code + ': cooler annotation');
  assert.ok(tags.some(t => t.annotation === '+5.0 °C vs state median'), code + ': hotter annotation');
  assert.equal(tags.filter(t => t.annotation === 'No data').length, 12, code + ': missing data labelled');
  for (const tag of tags) {
    // The comparison needs to fit, even for short location names.
    assert.ok(tag.width >= (tag.annotation.length * 6.5 + 28) * view.width / 1000,
      code + ': comparison text is wider than its label');
    assert.ok(tag.x >= view.x && tag.y >= view.y, code + ': label starts inside viewport');
    assert.ok(tag.x + tag.width <= view.x + view.width + 0.01, code + ': label width clips');
    assert.ok(tag.y + tag.height <= view.y + view.height + 0.01, code + ': label height clips');
    for (const other of tags) {
      if (tag === other) continue;
      assert.ok(tag.x + tag.width <= other.x || other.x + other.width <= tag.x ||
        tag.y + tag.height <= other.y || other.y + other.height <= tag.y,
        code + ': labels must not overlap');
    }
  }
  // Rainfall uses longer text, so check that layout too.
  rows[0].average_annual_rainfall_mm = 100;
  rows[1].average_annual_rainfall_mm = 1800;
  for (const tag of A.labelLayout(points, 'average_annual_rainfall_mm', code, '', view)) {
    assert.ok(tag.width >= (tag.annotation.length * 6.5 + 28) * view.width / 1000,
      code + ': rainfall text is wider than its label');
    assert.ok(tag.x + tag.width <= view.x + view.width + 0.01);
  }
  rows[0].average_annual_rainfall_mm = null;
  rows[1].average_annual_rainfall_mm = null;
  rows[0].annual_mean_c = null;
  rows[1].annual_mean_c = null;
}
console.log('Passed: eight state zoom layouts, 14 readable annotations, exact relative values, missing-data handling');
