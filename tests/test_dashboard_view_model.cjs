const {test} = require('node:test');
const assert = require('node:assert/strict');
const Data = require('../static/dashboard_data.js');
const State = require('../static/dashboard_state.js');
const View = require('../static/dashboard_view_model.js');

const meta={source:'Open-Meteo Historical Weather API',model:'era5',
  start_date:'2015-01-01',end_date:'2025-12-31'};
const syd={id:'syd',name:'Sydney',state:'NSW',latitude:-33.8688,longitude:151.2093,
  annual_mean_c:21,annual_average_max_c:24.2,average_annual_rainfall_mm:1100,
  monthly_average_max_c:[25,25,24,23,20,18,17,18,20,21,23,24]};
const mel={id:'mel',name:'Melbourne',state:'VIC',latitude:-37.8136,longitude:144.9631,
  annual_mean_c:17,annual_average_max_c:20,average_annual_rainfall_mm:600,
  monthly_average_max_c:[23,23,22,20,17,15,14,15,17,19,21,22]};
function bundle(missing=false) {
  return Data.makeBundle(
    {...meta,locations:[syd,mel],skipped:[]},
    {...meta,locations:missing?[{id:'syd',years:[{year:2015}]}]:
      [{id:'syd',years:[{year:2015}]},{id:'mel',years:[{year:2015}]}],skipped:[]},
    {...meta,locations:[{id:'syd',seasons:[]},{id:'mel',seasons:[]}],skipped:[]}
  );
}
test('one selection snapshot drives all three views',()=>{
  const b=bundle();
  const s=State.newStore(b.locations,{cityId:'syd',baselineId:'mel'});
  s.selectTab('historical');
  s.selectMetric('annual_mean_c');
  const v=View.make(b,s.getState());
  assert.equal(v.activeTab,'historical');
  assert.equal(v.selection.cityName,'Sydney');
  assert.equal(v.selection.baselineName,'Melbourne');
  assert.equal(v.overview.locations.length,1);
  assert.equal(v.overview.selectedMetric.value,21);
  assert.equal(v.overview.monthly.length,12);
  assert.equal(v.historical.selected.id,'syd');
  assert.equal(v.historical.baseline.id,'mel');
  assert.equal(v.compare.ready,true);
  assert.equal(v.compare.rows.find(r=>r.key==='annual_mean_c').difference,4);
  assert.equal(v.source.model,'era5');
});
test('tab changes do not discard selected or baseline records',()=>{
  const b=bundle(),s=State.newStore(b.locations);
  s.selectCity('syd');s.selectBaseline('mel');
  for(const tab of ['overview','historical','compare']) {
    s.selectTab(tab);
    const v=View.make(b,s.getState());
    assert.equal(v.overview.selected.id,'syd');
    assert.equal(v.historical.baseline.id,'mel');
    assert.equal(v.activeTab,tab);
  }
});
test('choosing state without city never silently chooses a sample city',()=>{
  const b=bundle(),s=State.newStore(b.locations);
  s.selectState('NSW');
  const v=View.make(b,s.getState());
  assert.equal(v.overview.locations.length,1);
  assert.equal(v.overview.selected,null);
  assert.equal(v.overview.selectedMetric.value,null);
  assert.equal(v.compare.ready,false);
  assert.equal(v.historical.selected,null);
});
test('missing annual records are explicitly unavailable for that city',()=>{
  const b=bundle(true),s=State.newStore(b.locations,{cityId:'mel',baselineId:'syd'});
  const v=View.make(b,s.getState());
  assert.equal(v.historical.selected,null);
  assert.equal(v.historical.hasSelectedHistory,false);
  assert.equal(v.historical.baseline.id,'syd');
  assert.ok(v.warnings.some(n=>n.includes('missing')));
});
test('does not turn unavailable metrics into zero or invent monthly values',()=>{
  const b=bundle(),s=State.newStore(b.locations,{cityId:'syd',baselineId:'mel'});
  s.selectMetric('hottest_day_c');
  const v=View.make(b,s.getState());
  assert.equal(v.overview.selectedMetric.value,null);
  assert.equal(v.compare.rows.find(r=>r.key==='hottest_day_c').selectedText,'No data');
});
test('rejects malformed state and unvalidated bundles',()=>{
  const b=bundle(),s=State.newStore(b.locations);
  assert.throws(()=>View.make(null,s.getState()),/validated/);
  assert.throws(()=>View.make(b,{tab:'made-up'}),/valid UrbanHeatState/);
});
