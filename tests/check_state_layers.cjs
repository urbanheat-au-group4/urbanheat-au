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
  assert.ok(viewLabels.length>0, code+' has no visible callouts');
}
console.log('Passed: all 8 real catalogue state zoom extents and marker IDs');
