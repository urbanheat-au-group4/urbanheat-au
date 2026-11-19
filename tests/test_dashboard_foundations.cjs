// UHA-112 foundation tests. No browser, server or provider data needed.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const State = require('../static/dashboard_state.js');
const Metrics = require('../static/dashboard_metrics.js');

const places = [
  {id:'syd',name:'Sydney',state:'NSW',latitude:-33.8688,longitude:151.2093,
    annual_mean_c:21.1,annual_average_max_c:24.3,average_annual_rainfall_mm:1120.7,
    average_days_at_least_35c:11.6,monthly_average_max_c:[27,27,26,24,21,18,17,19,21,23,25,26]},
  {id:'mel',name:'Melbourne',state:'VIC',latitude:-37.8136,longitude:144.9631,
    annual_mean_c:17.2,annual_average_max_c:20.8,average_annual_rainfall_mm:620.1,
    average_days_at_least_35c:7.1,monthly_average_max_c:[24,24,22,19,16,14,13,15,17,19,21,23]},
  {id:'near',name:'Near Sydney',state:'NSW',latitude:-33.87,longitude:151.21,
    annual_mean_c:21.1,average_annual_rainfall_mm:null},
];

test('initial state validates unknown ids, metrics and tabs', () => {
  const s=State.newStore(places,{cityId:'bad',baselineId:'mel',tab:'bad',metric:'bad'}).getState();
  assert.equal(s.cityId,''); assert.equal(s.baselineId,'mel');
  assert.equal(s.tab,'overview'); assert.equal(s.metric,State.DEFAULT_METRIC);
  assert.equal(s.state,'ALL'); assert.equal(s.baselineState,'VIC');
});
test('state without a city persists, and city selection updates map state', () => {
  const store=State.newStore(places);
  store.selectState('NSW');
  assert.equal(store.getState().state,'NSW');
  assert.equal(store.getState().cityId,'');
  store.selectCity('syd');
  assert.equal(store.getState().state,'NSW');
  store.selectState('VIC');
  assert.equal(store.getState().cityId,'');
  assert.equal(store.getState().state,'VIC');
  store.selectCity('mel');
  assert.equal(store.getState().state,'VIC');
});
test('tabs/metrics preserve both selected locations', () => {
  const s=State.newStore(places);
  s.selectCity('syd');s.selectBaseline('mel');
  s.selectTab('historical');s.selectMetric('average_annual_rainfall_mm');
  s.selectTab('compare');
  assert.deepEqual([s.getState().cityId,s.getState().baselineId,s.getState().metric],
    ['syd','mel','average_annual_rainfall_mm']);
});
test('same city cannot be both selected and baseline', () => {
  const s=State.newStore(places,{cityId:'syd',baselineId:'syd'});
  assert.equal(s.getState().baselineId,'');
  s.selectBaseline('mel');s.selectCity('mel');
  assert.equal(s.getState().baselineId,'');
});
test('swap updates city, baseline and map state', () => {
  const s=State.newStore(places,{cityId:'syd',baselineId:'mel'});
  s.swap();assert.deepEqual([s.getState().cityId,s.getState().baselineId,s.getState().state],
    ['mel','syd','VIC']);
});
test('subscribe receives changes and unsubscribe stops notifications', () => {
  const s=State.newStore(places);let received=0;
  const unsubscribe=s.subscribe(() => received++);
  s.selectTab('historical');s.selectTab('historical');
  assert.equal(received,1);unsubscribe();s.selectTab('compare');assert.equal(received,1);
});
test('metadata and missing figures are never invented', () => {
  assert.equal(Metrics.value(places[2],'average_annual_rainfall_mm'),null);
  assert.equal(Metrics.compareRows(places[0],null).rows[0].difference,null);
  assert.equal(Metrics.compareRows(places[0],places[1]).rows.find(r=>r.key==='hottest_day_c').selectedText,'No data');
  assert.deepEqual(Metrics.monthlySeries({monthly_average_max_c:[1]}),Array(12).fill(null));
  assert.deepEqual(Metrics.monthlySeries({monthly_average_max_c:[1,2,3,4,5,6,7,8,9,10,11,null]}).slice(-2),[11,null]);
  assert.equal(Metrics.source({model:'era5',start_date:'2015-01-01'}).start,'2015-01-01');
});
test('distant cities compare correctly including units and signs', () => {
  const {rows,nearby}=Metrics.compareRows(places[0],places[1]);
  assert.equal(nearby,false);
  const mean=rows.find(r=>r.key==='annual_mean_c');
  assert.equal(mean.difference,3.9);assert.equal(mean.differenceText,'+3.9 °C');
  const rain=rows.find(r=>r.key==='average_annual_rainfall_mm');
  assert.equal(rain.difference,501);assert.equal(rain.differenceText,'+501 mm');
});
test('nearby model grid locations do not claim measurable differences', () => {
  const r=Metrics.compareRows(places[0],places[2]);
  assert.equal(r.nearby,true);assert.ok(r.notes.some(n=>n.includes('25 km')));
  r.rows.forEach(row=>assert.equal(row.difference,null));
});
test('same city and absent coordinates produce no fake delta', () => {
  assert.equal(Metrics.compareRows(places[0],places[0]).rows[0].difference,null);
  const unknown={...places[1],latitude:null};
  const r=Metrics.compareRows(places[0],unknown);
  assert.equal(r.distanceKm,null);assert.equal(r.rows[0].difference,null);
});
