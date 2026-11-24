// Offline tests for the shared UHA-112 map/history/seasons data adapter.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const adapter = require('../static/dashboard_data.js');
const meta = {
  model: 'era5', source: 'Open-Meteo Historical Weather API',
  start_date: '2015-01-01', end_date: '2025-12-31'
};
function exportsFor(ids=['mel', 'syd']) {
  const rows=ids.map((id,i)=>({id,name:id,state:i?'NSW':'VIC',annual_mean_c:15+i}));
  return [
    {...meta,locations:rows,skipped:[]},
    {...meta,locations:ids.map(id=>({id,years:[{year:2015,annual_mean_c:18}]})),skipped:[]},
    {...meta,locations:ids.map(id=>({id,seasons:[{season:'summer',typical_max:25}]})),skipped:[]}
  ];
}
test('combines three matching exports without changing numeric rows',()=>{
  const [map,hist,seas]=exportsFor();
  const b=adapter.makeBundle(map,hist,seas);
  assert.equal(b.locations.length,2);
  assert.equal(b.get('syd').map.annual_mean_c,16);
  assert.equal(b.get('syd').history.years[0].year,2015);
  assert.equal(b.get('mel').seasons.seasons[0].typical_max,25);
  assert.equal(b.byState('VIC').length,1);
  assert.equal(b.byState('ALL').length,2);
  assert.equal(b.source.model,'era5');
  assert.deepEqual(b.warnings,[]);
});
test('selected and baseline follow IDs, no arbitrary fallback city',()=>{
  const b=adapter.makeBundle(...exportsFor());
  assert.equal(b.forSelection({cityId:'syd',baselineId:'mel'}).selected.map.id,'syd');
  assert.equal(b.forSelection({cityId:'',baselineId:'unknown'}).selected.map,null);
  assert.equal(b.get('unknown').history,null);
});
test('missing history and seasons are warned about, never substituted',()=>{
  const [map,hist,seas]=exportsFor();
  hist.locations=hist.locations.slice(0,1);
  seas.skipped=['syd'];
  const b=adapter.makeBundle(map,hist,seas);
  assert.equal(b.get('syd').map.id,'syd');
  assert.equal(b.get('syd').history,null);
  assert.deepEqual(b.missing.history,['syd']);
  assert.equal(b.warnings.length,2);
});
test('period or model mismatch fails before UI can mix datasets',()=>{
  const a=exportsFor();
  a[1].start_date='2016-01-01';
  assert.throws(()=>adapter.makeBundle(...a),/mismatch/);
  const b=exportsFor();
  b[2].model='another-model';
  assert.throws(()=>adapter.makeBundle(...b),/mismatch/);
});
test('different source provenance is rejected even with same model and period',()=>{
  const docs=exportsFor();
  docs[2].source='Unknown alternate provider';
  assert.throws(()=>adapter.makeBundle(...docs),/mismatch/);
});
test('missing metadata and duplicate IDs are rejected',()=>{
  const a=exportsFor();delete a[0].model;
  assert.throws(()=>adapter.makeBundle(...a),/metadata|missing/);
  const b=exportsFor();b[1].locations.push({...b[1].locations[0]});
  assert.throws(()=>adapter.makeBundle(...b),/duplicated/);
});
test('fetch loads all three in parallel and returns joined data',async()=>{
  const sources=exportsFor();const paths=Object.values(adapter.FILES);const calls=[];
  const b=await adapter.load(async (url,opts)=>{
    calls.push([url,opts.cache]);
    return {ok:true,json:async()=>sources[paths.indexOf(url)]};
  });
  assert.deepEqual(calls.map(c=>c[0]),paths);
  assert.ok(calls.every(c=>c[1]==='no-store'));
  assert.equal(b.get('mel').history.id,'mel');
});
test('HTTP failures include the failed export name',async()=>{
  await assert.rejects(
    adapter.load(async url=>url.includes('history')?{ok:false,status:503}:{ok:true,json:async()=>exportsFor()[0]}),
    /history export could not be loaded: HTTP 503/);
});
test('invalid response JSON does not return partial data',async()=>{
  const paths=Object.values(adapter.FILES);
  await assert.rejects(adapter.load(async url=>({
    ok:true,json:async()=>url===paths[1]?Promise.reject(new SyntaxError('bad JSON')):exportsFor()[0]
  })),/history export could not be loaded: bad JSON/);
});
