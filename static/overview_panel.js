// Overview right-hand panel: selected location, baseline, summary figures, monthly preview.
// Uses the same national_data.json as the map. Missing values show "No data", never zero.
(function () {
  'use strict';

  var DEFAULT_BASELINE = 'melbourne-cbd';
  var STORE_KEY = 'urbanheat.baseline';
  var MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
  var MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var NS = 'http://www.w3.org/2000/svg';
  var MEASURES = [
    { key: 'annual_mean_c', label: 'Annual mean temperature', unit: '°C', decimals: 1 },
    { key: 'average_annual_rainfall_mm', label: 'Annual rainfall', unit: 'mm', decimals: 0 },
    { key: 'average_days_at_least_35c', label: 'Days at or above 35 °C', unit: 'days', decimals: 1 }
  ];

  var place = document.getElementById('place');
  var baselineSelect = document.getElementById('baseline');
  var badge = document.getElementById('era5-badge');
  var card = document.getElementById('location-card');
  var detail = document.getElementById('detail');
  if (!place || !baselineSelect) { return; }

  var core = window.CompareCore || null;
  var points = [];
  var byId = {};
  var period = '';

  function $(id) { return document.getElementById(id); }
  function isNum(value) { return typeof value === 'number' && Number.isFinite(value); }
  function isDesktop() { return window.matchMedia('(min-width: 1101px)').matches; }

  function figure(value, decimals, unit) {
    return isNum(value) ? value.toFixed(decimals) + ' ' + unit : 'No data';
  }

  function setText(id, text) { var node = $(id); if (node) { node.textContent = text; } }

  function readBaseline() {
    try { return window.sessionStorage.getItem(STORE_KEY) || ''; } catch (error) { return ''; }
  }
  function saveBaseline(id) {
    try { window.sessionStorage.setItem(STORE_KEY, id); } catch (error) { /* storage unavailable */ }
  }

  function fillBaseline() {
    var sorted = points.slice().sort(function (a, b) { return a.name.localeCompare(b.name); });
    baselineSelect.replaceChildren();
    sorted.forEach(function (p) {
      baselineSelect.add(new Option(p.name + ' (' + p.state + ')', p.id));
    });
    var wanted = readBaseline();
    var start = byId[wanted] ? wanted : (byId[DEFAULT_BASELINE] ? DEFAULT_BASELINE : sorted[0].id);
    baselineSelect.value = start;
  }

  function differenceText(selected, base, measure) {
    if (!selected) { return { text: '—', note: '' }; }
    if (selected.id === base.id) { return { text: 'Same location', note: '' }; }
    if (core && core.distanceKm(selected, base) < core.NEAR_KM) {
      return {
        text: 'Not shown',
        note: selected.name + ' and ' + base.name + ' are only about ' +
          Math.max(1, Math.round(core.distanceKm(selected, base))) +
          ' km apart. The climate model works on a grid of about ' + core.NEAR_KM +
          ' km, so it cannot reliably tell them apart.'
      };
    }
    var a = selected[measure.key];
    var b = base[measure.key];
    if (!isNum(a) || !isNum(b)) { return { text: 'No data', note: '' }; }
    var diff = Number((a - b).toFixed(measure.decimals)) || 0;
    if (diff === 0) { return { text: 'Same', note: '' }; }
    return { text: (diff > 0 ? '+' : '-') + Math.abs(diff).toFixed(measure.decimals) + ' ' + measure.unit, note: '' };
  }

  function renderCards(selected, base) {
    setText('ov-selected-name', selected ? selected.name : 'Choose a location');
    setText('ov-selected-sub', selected ? selected.state + ' · selected location' : 'Use the map or the location selector');
    setText('ov-baseline-name', base.name);
    setText('ov-baseline-sub', base.state + ' · baseline location');
    var kpis = [
      ['ov-kpi-temp', MEASURES[0]],
      ['ov-kpi-rain', MEASURES[1]],
      ['ov-kpi-hot', MEASURES[2]]
    ];
    kpis.forEach(function (item) {
      var node = $(item[0]);
      if (!node) { return; }
      node.textContent = selected ? figure(selected[item[1].key], item[1].decimals, item[1].unit) : '—';
      node.classList.toggle('is-empty', !selected || !isNum(selected[item[1].key]));
    });
  }

  function renderTable(selected, base) {
    setText('ov-compare-sub', 'Selected ' + (selected ? selected.name : '—') + ' / Baseline ' + base.name);
    var body = $('ov-compare-body');
    body.replaceChildren();
    var notes = [];
    MEASURES.forEach(function (measure) {
      var row = document.createElement('tr');
      var head = document.createElement('th');
      head.scope = 'row';
      head.textContent = measure.label;
      var baseCell = document.createElement('td');
      baseCell.textContent = figure(base[measure.key], measure.decimals, measure.unit);
      var diffCell = document.createElement('td');
      var diff = differenceText(selected, base, measure);
      diffCell.textContent = diff.text;
      if (diff.note && notes.indexOf(diff.note) < 0) { notes.push(diff.note); }
      row.append(head, baseCell, diffCell);
      body.append(row);
    });
    setText('ov-compare-note', notes.join(' '));
  }

  function svgNode(tag, attrs) {
    var node = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (key) { node.setAttribute(key, String(attrs[key])); });
    return node;
  }

  function series(point) {
    var values = point && Array.isArray(point.monthly_average_max_c) ? point.monthly_average_max_c : [];
    return MONTHS.map(function (_m, i) { return isNum(values[i]) ? values[i] : null; });
  }

  function drawSeries(chart, values, x, y, className, square) {
    var path = '';
    var drawing = false;
    values.forEach(function (value, i) {
      if (value === null) { drawing = false; return; }
      path += (drawing ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(value).toFixed(1) + ' ';
      drawing = true;
    });
    if (path) { chart.append(svgNode('path', { d: path, class: 'ov-line ' + className })); }
    values.forEach(function (value, i) {
      if (value === null) { return; }
      chart.append(square
        ? svgNode('rect', { x: (x(i) - 3).toFixed(1), y: (y(value) - 3).toFixed(1), width: 6, height: 6, class: 'ov-dot ' + className })
        : svgNode('circle', { cx: x(i).toFixed(1), cy: y(value).toFixed(1), r: 3.4, class: 'ov-dot ' + className }));
    });
  }

  function renderMonthly(selected, base) {
    var chart = $('ov-monthly');
    var table = $('ov-monthly-values');
    chart.replaceChildren();
    table.replaceChildren();
    var baseValues = series(base);
    var selValues = selected ? series(selected) : [];
    var all = baseValues.concat(selValues).filter(isNum);
    var status = $('ov-monthly-status');
    if (!all.length) {
      status.textContent = 'No monthly data for these locations.';
      chart.setAttribute('aria-label', 'No monthly data');
      return;
    }
    var missing = [];
    if (selected && !selValues.some(isNum)) { missing.push(selected.name); }
    if (!baseValues.some(isNum)) { missing.push(base.name); }
    status.textContent = selected
      ? (missing.length ? 'No monthly data for ' + missing.join(' or ') + '.' : '')
      : 'Choose a location to compare its months with the baseline.';
    var box = chart.getBoundingClientRect();
    var W = Math.max(300, Math.round(box.width) || 640);
    var H = isDesktop() && box.height >= 50 ? Math.round(box.height) : 120;
    var left = 34, right = 8, top = 8, bottom = 18;
    var lo = Math.floor(Math.min.apply(null, all) - 1);
    var hi = Math.ceil(Math.max.apply(null, all) + 1);
    var x = function (i) { return left + (W - left - right) * i / 11; };
    var y = function (v) { return top + (H - top - bottom) * (1 - (v - lo) / (hi - lo)); };
    chart.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    [lo, hi].forEach(function (tick) {
      chart.append(svgNode('line', { x1: left, x2: W - right, y1: y(tick), y2: y(tick), class: 'ov-grid' }));
      var label = svgNode('text', { x: left - 5, y: y(tick) + 4, 'text-anchor': 'end', class: 'ov-axis' });
      label.textContent = tick + '°';
      chart.append(label);
    });
    MONTHS.forEach(function (name, i) {
      var label = svgNode('text', { x: x(i), y: H - 4, 'text-anchor': 'middle', class: 'ov-axis' });
      label.textContent = name;
      chart.append(label);
    });
    drawSeries(chart, baseValues, x, y, 'ov-base', true);
    if (selected) { drawSeries(chart, selValues, x, y, 'ov-selected', false); }
    chart.setAttribute('aria-label', 'Average daily maximum temperature by month for ' +
      (selected ? selected.name + ' and ' : '') + base.name + ' (baseline). Values are in the table that follows.');

    var head = document.createElement('tr');
    ['Month'].concat(selected ? [selected.name] : [], [base.name + ' (baseline)']).forEach(function (text) {
      var th = document.createElement('th');
      th.scope = 'col';
      th.textContent = text;
      head.append(th);
    });
    table.append(head);
    MONTH_NAMES.forEach(function (name, i) {
      var row = document.createElement('tr');
      var th = document.createElement('th');
      th.scope = 'row';
      th.textContent = name;
      row.append(th);
      if (selected) { var a = document.createElement('td'); a.textContent = figure(selValues[i], 1, '°C'); row.append(a); }
      var b = document.createElement('td');
      b.textContent = figure(baseValues[i], 1, '°C');
      row.append(b);
      table.append(row);
    });
  }

  function render() {
    var base = byId[baselineSelect.value];
    if (!base) { return; }
    var selected = byId[place.value] || null;
    renderCards(selected, base);
    renderTable(selected, base);
    renderMonthly(selected, base);
    setText('ov-monthly-legend-selected', selected ? selected.name : 'No location selected');
    setText('ov-monthly-legend-base', base.name + ' (baseline)');
  }

  // The map and the location selector (national.js) change the selection without telling us,
  // so watch the details box it rewrites on every redraw.
  function watch() {
    var timer = null;
    window.addEventListener('resize', function () { clearTimeout(timer); timer = setTimeout(render, 150); });
    place.addEventListener('change', render);
    if (detail) { new MutationObserver(render).observe(detail, { childList: true, characterData: true, subtree: true }); }
    baselineSelect.addEventListener('change', function () { saveBaseline(baselineSelect.value); render(); });
  }

  // On wide screens the details card is a pop-up opened on request, not every time a place is chosen.
  function tameCard() {
    if (!card) { return; }
    var summary = card.querySelector('summary');
    if (summary) { summary.addEventListener('click', function () { card.dataset.user = '1'; }); }
    card.addEventListener('toggle', function () { if (!card.open) { delete card.dataset.user; } });
    function closeIfAutomatic() { if (isDesktop() && card.open && card.dataset.user !== '1') { card.open = false; } }
    new MutationObserver(closeIfAutomatic).observe(card, { attributes: true, attributeFilter: ['open'] });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && isDesktop() && card.open) { card.open = false; if (summary) { summary.focus(); } }
    });
    closeIfAutomatic();
  }

  function setBadge(data) {
    var start = String(data.start_date || '').slice(0, 4);
    var end = String(data.end_date || '').slice(0, 4);
    var model = data.model ? String(data.model).toUpperCase() : '';
    if (!model || !start || !end) { badge.textContent = 'Source details unavailable'; return; }
    period = start + '–' + end;
    badge.textContent = model + ' modelled historical weather · ' + period;
  }

  tameCard();
  fetch('/static/national_data.json', { cache: 'no-store' })
    .then(function (response) { if (!response.ok) { throw new Error('missing'); } return response.json(); })
    .then(function (data) {
      if (!Array.isArray(data.locations) || !data.locations.length) { throw new Error('empty'); }
      points = data.locations;
      points.forEach(function (p) { byId[p.id] = p; });
      setBadge(data);
      fillBaseline();
      watch();
      render();
    })
    .catch(function () {
      badge.textContent = 'Source details unavailable';
      setText('ov-selected-sub', 'Climate data is unavailable right now.');
    });
}());
