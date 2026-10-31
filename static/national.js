// Separate from the Melbourne dashboard so the two pages don't interfere.
const svg = document.getElementById('national-map');
const state = document.getElementById('state');
const metric = document.getElementById('metric');
const place = document.getElementById('place');
const detail = document.getElementById('detail');
const NS = 'http://www.w3.org/2000/svg';
const FIELDS = {annual_mean_c:'Average temperature',annual_average_max_c:'Daytime maximum',annual_average_min_c:'Nighttime minimum',average_annual_rainfall_mm:'Annual rainfall',average_days_at_least_35c:'Days ≥35°C per year'};
let points = [], selected = '';
let boundaries = [];
const LABEL_POSITIONS={WA:[315,345],NT:[515,225],SA:[575,475],QLD:[730,295],NSW:[770,550],VIC:[730,625],TAS:[810,705],ACT:[885,575]};
const STATE_NAMES = {NSW:'New South Wales', VIC:'Victoria', QLD:'Queensland', WA:'Western Australia',SA:'South Australia', TAS:'Tasmania', ACT:'Australian Capital Territory', NT:'Northern Territory'};
function boundaryState(feature) {
  const p=feature.properties||{};
  const raw=String(p.shapeName||p.STE_NAME21||p.name||p.NAME_1||p.admin1Name||'').toLowerCase().trim();
  return Object.keys(STATE_NAMES).find(code=>raw===code.toLowerCase()||raw===STATE_NAMES[code].toLowerCase());
}
function unit(key){return key.includes('rainfall')?' mm':key.includes('days')?' days':' °C';}
function formatted(value,key){return Number.isFinite(value)?value.toFixed(1)+unit(key):'Unavailable';}
function stateAverages(){
  const results={};
  for(const code of Object.keys(STATE_NAMES)){
    const rows=points.filter(p=>p.state===code&&Number.isFinite(p[metric.value]));
    if(rows.length)results[code]={
      value:rows.reduce((total,p)=>total+p[metric.value],0)/rows.length,
      x:rows.reduce((total,p)=>total+p.x,0)/rows.length,
      y:rows.reduce((total,p)=>total+p.y,0)/rows.length
    };
  }
  return results;
}
function updateHighlights(visible){
  const panel=document.getElementById('highlights');
  panel.replaceChildren();
  const rows=visible.filter(p=>Number.isFinite(p[metric.value])).sort((a,b)=>a[metric.value]-b[metric.value]);
  if(!rows.length)return;
  for(const [label,point] of [['Lowest',rows[0]],['Highest',rows[rows.length-1]]]){
    const card=document.createElement('div'),caption=document.createElement('span'),
      name=document.createElement('strong'),value=document.createElement('b');
    caption.textContent=label+' · '+FIELDS[metric.value];
    name.textContent=point.name+' ('+point.state+')';
    value.textContent=formatted(point[metric.value],metric.value);
    card.append(caption,name,value);panel.append(card);
  }
}
function element(tag, attributes={}) {
  const node = document.createElementNS(NS,tag);
  for (const [key,value] of Object.entries(attributes)) node.setAttribute(key,String(value));
  return node;
}
function project(coordinate) {
  const [lon,lat]=coordinate;
  return [36+(lon-112)*(1000-72)/(154.5-112),36+(-10-lat)*(760-72)/(-10+44.5)];
}
function paths(geometry) {
  // Draw complete polygons, including holes. Skip invalid and tiny detached shapes.
  if (!geometry) return '';
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] :
    geometry.type === 'MultiPolygon' ? geometry.coordinates : [];
  const output = [];
  for (const polygon of polygons) {
    if (!Array.isArray(polygon) || !polygon.length) continue;
    const outer = polygon[0];
    if (!Array.isArray(outer) || outer.length < 4) continue;
    const projected = outer.map(point => {
      if (!Array.isArray(point) || point.length < 2 ||
          !Number.isFinite(point[0]) || !Number.isFinite(point[1]) ||
          point[0] < 110 || point[0] > 156 || point[1] < -46 || point[1] > -9) return null;
      return project(point);
    });
    if (projected.includes(null)) continue;
    let area = 0;
    for (let i = 0; i < projected.length; i++) {
      const [x1,y1] = projected[i], [x2,y2] = projected[(i+1)%projected.length];
      area += x1*y2-x2*y1;
    }
    // Small offshore islands overwhelm the map at this zoom.
    if (Math.abs(area)/2 < 6) continue;
    for (const ring of polygon) {
      if (!Array.isArray(ring) || ring.length < 4) continue;
      const points = ring.map(point => project(point));
      if (points.some(p => !Number.isFinite(p[0]) || !Number.isFinite(p[1]))) continue;
      output.push(points.map((p,i) =>
        (i ? 'L' : 'M') + p[0].toFixed(2) + ',' + p[1].toFixed(2)
      ).join(' ') + 'Z');
    }
  }
  return output.join(' ');
}
function color(value,low,high) {
  const t=high===low?.5:Math.max(0,Math.min(1,(value-low)/(high-low)));
  const stops=[[82,163,195],[244,231,178],[221,110,64]];
  const i=Math.min(1,Math.floor(t*2)),a=t*2-i;
  return 'rgb('+stops[i].map((v,j)=>Math.round(v+(stops[i+1][j]-v)*a)).join(',')+')';
}
function selectPoint(id){selected=id;place.value=id;draw();}
function draw(){
  svg.replaceChildren();
  const group=state.value,visible=points.filter(p=>group==='ALL'||p.state===group);
  const values=visible.map(p=>p[metric.value]).filter(Number.isFinite);
  const low=Math.min(...values),high=Math.max(...values);
  const averages=stateAverages();
  const allValues=points.map(p=>p[metric.value]).filter(Number.isFinite);
  const backdrop=element('g',{'aria-label':'Australian state outlines'});
  for(const feature of boundaries){
    const d=paths(feature.geometry);
    if(d){
      const code=boundaryState(feature),average=averages[code];
      backdrop.append(element('path',{d,class:'boundary','fill-rule':'evenodd',
        fill:average?color(average.value,Math.min(...allValues),Math.max(...allValues)):'#cddfe6',
        'fill-opacity':1}));
    }
  }
  svg.append(backdrop);
  // Keep names outside the map so they don't cover borders or each other.
  const summary=document.getElementById('state-summary');
  summary.replaceChildren();
  for(const [code,average] of Object.entries(averages)){
    if(group!=='ALL'&&code!==group)continue;
    const item=document.createElement('div');
    item.className='state-summary-item';
    const name=document.createElement('strong');name.textContent=code;
    const value=document.createElement('span');value.textContent=formatted(average.value,metric.value);
    item.append(name,value);summary.append(item);
  }
  for(const p of visible){
    const value=p[metric.value],valid=Number.isFinite(value);
    const circle=element('circle',{cx:p.x,cy:p.y,r:p.id===selected?9:5.5,
      fill:valid?color(value,low,high):'#9ba9b2',
      class:'marker'+(p.id===selected?' selected':''),
      role:'button',tabindex:'0',
      'aria-label':p.name+', '+p.state+': '+(valid?value:'unavailable')});
    const title=element('title');title.textContent=p.name+', '+p.state;circle.append(title);
    circle.addEventListener('click',()=>selectPoint(p.id));
    circle.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectPoint(p.id);}});
    svg.append(circle);
  }
  document.getElementById('low').textContent=values.length?formatted(low,metric.value):'—';
  document.getElementById('high').textContent=values.length?formatted(high,metric.value):'—';
  document.getElementById('status').textContent=visible.length+' locations';
  updateHighlights(visible);
  const point=points.find(p=>p.id===selected);
  if(!point){detail.textContent='Choose a location on the map to see its climate results.';return;}
  detail.replaceChildren();
  const heading=document.createElement('strong');heading.textContent=point.name+' · '+point.state;
  detail.append(heading);
  for(const [key,label] of Object.entries(FIELDS)){
    const line=document.createElement('div'),value=point[key];
    line.textContent=label+': ';
    const span=document.createElement('span');span.className='value';
    span.textContent=Number.isFinite(value)?value.toFixed(1)+(key.includes('rainfall')?' mm':key.includes('days')?' days':' °C'):'Unavailable';
    line.append(span);detail.append(line);
  }
}
async function load(){
  try{
    const response=await fetch('/static/national_data.json',{cache:'no-store'});
    if(!response.ok)throw new Error('Run python3 national_export.py first');
    const data=await response.json();
    if(!Array.isArray(data.locations))throw new Error('Invalid national data');
    points=data.locations;
    for(const code of [...new Set(points.map(p=>p.state))].sort()){
      const option=document.createElement('option');option.value=code;option.textContent=code;state.append(option);
    }
    for(const p of [...points].sort((a,b)=>a.name.localeCompare(b.name))){
      const option=document.createElement('option');option.value=p.id;option.textContent=p.name+' ('+p.state+')';place.append(option);
    }
    try{
      const boundaryResponse=await fetch('/static/australia_states.geojson');
      if(boundaryResponse.ok){const geo=await boundaryResponse.json();if(geo.type==='FeatureCollection')boundaries=geo.features||[];}
    }catch(_error){/* Map markers still work without the optional boundary file. */}
    draw();
    if(!boundaries.length)document.getElementById('status').textContent+=' · state outlines not installed';
  }catch(error){document.getElementById('status').textContent=error.message;}
}
state.addEventListener('change',()=>{selected='';place.value='';draw();});
metric.addEventListener('change',draw);
place.addEventListener('change',()=>{selected=place.value;const p=points.find(p=>p.id===selected);if(p)state.value='ALL';draw();});
load();
