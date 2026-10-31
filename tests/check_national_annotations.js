const assert = require('node:assert/strict');
const A = require('../static/national_annotations.js');

const points = [
  {id:'darwin', name:'Darwin', state:'NT', x:420,y:80,latitude:-12.4,annual_mean_c:28},
  {id:'qld-cairns', name:'Cairns', state:'QLD', x:760,y:130,latitude:-16.9,annual_mean_c:25},
  {id:'perth',name:'Perth',state:'WA',x:120,y:470,latitude:-31.9,annual_mean_c:18},
  {id:'adelaide',name:'Adelaide',state:'SA',x:590,y:520,latitude:-34.9,annual_mean_c:18},
  {id:'sydney',name:'Sydney',state:'NSW',x:850,y:540,latitude:-33.8,annual_mean_c:20},
  {id:'melbourne-cbd',name:'Melbourne CBD',state:'VIC',x:790,y:625,latitude:-37.8,annual_mean_c:16},
  {id:'hobart',name:'Hobart',state:'TAS',x:805,y:708,latitude:-42.8,annual_mean_c:13}
];
const metric = 'annual_mean_c';
assert.deepEqual(A.stateCounts(points),{NT:1,QLD:1,WA:1,SA:1,NSW:1,VIC:1,TAS:1});
assert.equal(A.format(20.156,metric),'20.2 °C');
assert.equal(A.format(null,metric),'No data');
const bands = A.bandSummaries(points,metric,'ALL');
assert.equal(bands.reduce((sum, b) => sum+b.count, 0),7);
assert.deepEqual(bands.map(b=>b.name),['Northern locations','Central latitudes','Southern locations']);
const vicView = A.stateViewBox(points,'VIC');
assert.ok(vicView.width < 1000);
assert.ok(vicView.width >= 190);
assert.deepEqual(A.stateViewBox(points,'ALL'),{x:0,y:0,width:1000,height:760});
assert.ok(vicView.x <= 790 && vicView.x+vicView.width >= 790);
assert.ok(vicView.y <= 625 && vicView.y+vicView.height >= 625);
const boxes = A.labelLayout(points,metric,'ALL','');
assert.ok(boxes.length >= 4, 'expected readable anchor labels');
for (const a of boxes) {
  assert.ok(a.x >= 0 && a.y >= 0 && a.x + a.width <= 1000 && a.y + a.height <= 760);
  for (const b of boxes) {
    if (a === b) continue;
    assert.ok(a.x + a.width + 8 <= b.x || b.x + b.width + 8 <= a.x ||
      a.y + a.height + 8 <= b.y || b.y + b.height + 8 <= a.y,
      'labels must not overlap');
  }
}
// Selected non-anchor places must still be labelled in the state view.
const vic = A.labelLayout(points,metric,'VIC','melbourne-cbd',vicView);
assert.ok(vic.some(box=>box.point.id==='melbourne-cbd'));
console.log('National annotation helpers passed');
