// Validate state zoom against the actual 112 catalogue locations.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const A = require('../static/national_annotations.js');
const catalogue = JSON.parse(fs.readFileSync(path.join(__dirname, '..','locations.json'), 'utf8')).locations;
const points = catalogue.filter(p => p.groups.includes('australia_historical')).map(p => ({
  ...p,
  x: 36+(p.longitude-112)*928/42.5,
  y: 36+(-10-p.latitude)*688/34.5
}));
assert.equal(points.length,112);
for (const code of ['NSW','VIC','QLD','WA','SA','TAS','ACT','NT']) {
  const rows = points.filter(p => p.state===code);
  assert.equal(rows.length,14, code+' expected fourteen records');
  assert.equal(new Set(rows.map(p=>p.id)).size,14,code+' duplicate IDs');
  const view=A.stateViewBox(points,code);
  for (const p of rows) {
    assert.ok(p.x>=view.x-0.01 && p.x<=view.x+view.width+0.01,
      code+' longitude outside state view: '+p.name);
    assert.ok(p.y>=view.y-0.01 && p.y<=view.y+view.height+0.01,
      code+' latitude outside state view: '+p.name);
  }
  const viewLabels=A.labelLayout(points,'annual_mean_c',code,'',view);
  assert.equal(viewLabels.length,14, code+' expected all fourteen on-map labels');
  assert.ok(viewLabels.every(x => x.annotation), code+' missing annotation');
}
const actView = A.stateViewBox(points, 'ACT');
assert.ok(actView.width < 100, 'ACT should have a readable close-up, not an entire-country viewport');
const vic = points.filter(p=>p.state==='VIC');
const fullVictoria = A.stateViewBox(points,'VIC',[[700,520],[850,660]]);
const focusVictoria = A.stateViewBox(points,'VIC',[[700,520],[850,660]],true);
assert.ok(A.hasClusteredCoverage(points,'VIC',[[700,520],[850,660]]));
assert.ok(focusVictoria.width < fullVictoria.width, 'Victoria sampled-location focus should zoom in');
assert.ok(vic.every(p=>p.x>=focusVictoria.x && p.x<=focusVictoria.x+focusVictoria.width));
console.log('Passed: eight state views, ACT close-up, and clustered sample zoom');
