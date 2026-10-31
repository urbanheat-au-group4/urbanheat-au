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
  if (!geometry) return '';
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : [];
  return polygons.flatMap(p=>p.map(r=>r.map((point,i)=>{
    const [x,y]=project(point);
    return (i?'L':'M')+x.toFixed(2)+','+y.toFixed(2);
  }).join(' ')+'Z')).join(' ');
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
  const backdrop=element('g',{'aria-label':'Australian state outlines'});
  for(const feature of boundaries){
    const d=paths(feature.geometry);
    if(d) backdrop.append(element('path',{d,class:'boundary','fill-rule':'evenodd'}));
  }
  svg.append(backdrop);
  for(const p of visible){
    const value=p[metric.value],valid=Number.isFinite(value);
    const circle=element('circle',{cx:p.x,cy:p.y,r:p.id===selected?9:6.5,
      fill:valid?color(value,low,high):'#9ba9b2',
      class:'marker'+(p.id===selected?' selected':''),
      role:'button',tabindex:'0',
      'aria-label':p.name+', '+p.state+': '+(valid?value:'unavailable')});
    const title=element('title');title.textContent=p.name+', '+p.state;circle.append(title);
    circle.addEventListener('click',()=>selectPoint(p.id));
    circle.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectPoint(p.id);}});
    svg.append(circle);
  }
  document.getElementById('low').textContent=values.length?low.toFixed(1):'—';
  document.getElementById('high').textContent=values.length?high.toFixed(1):'—';
  document.getElementById('status').textContent=visible.length+' locations';
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
