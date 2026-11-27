// Historical and Compare tabs: the selected location compared with the baseline location.
// Both locations come from the controls at the top of the page. Uses the same data files as the map.
// Missing values show "No data", never zero, and incomplete years are marked, never filled in.
(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var SEASONS = [['summer', 'Summer'], ['autumn', 'Autumn'], ['winter', 'Winter'], ['spring', 'Spring']];
  var core = window.CompareCore || null;
  var place = document.getElementById('place');
  var baselineSelect = document.getElementById('baseline');
  var stateSelect = document.getElementById('state');
  if (!place || !baselineSelect || !document.getElementById('hc-selected-name')) { return; }

  var points = [];
  var pointById = {};
  var historyById = {};
  var seasonsById = {};
  var meta = { source: '', model: '', start: '', end: '' };
  var legacyKey = '';

  function $(id) { return document.getElementById(id); }
  function isNum(v) { return typeof v === 'number' && Number.isFinite(v); }
  function isDesktop() { return window.matchMedia('(min-width: 1101px)').matches; }
  function setText(id, text) { var n = $(id); if (n) { n.textContent = text; } }
  function figure(v, d, unit) { return isNum(v) ? v.toFixed(d) + ' ' + unit : 'No data'; }
  function el(tag, text, cls) {
    var n = document.createElement(tag);
    if (text !== undefined) { n.textContent = text; }
    if (cls) { n.className = cls; }
    return n;
  }
  function svg(tag, attrs, text) {
    var n = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, String(attrs[k])); });
    if (text !== undefined) { n.textContent = text; }
    return n;
  }
  function label(p) { return p ? p.name + ' (' + p.state + ')' : ''; }

  // ---------- shared measures ----------
  var MEASURES = [
    { key: 'annual_mean_c', label: 'Annual mean', unit: '°C', d: 1 },
    { key: 'average_annual_rainfall_mm', label: 'Rainfall', unit: 'mm', d: 0 },
    { key: 'hottest_10_percent_mean_c', label: 'Hottest 10%', unit: '°C', d: 1 },
    { key: 'average_days_at_least_35c', label: 'Hot days', unit: 'days', d: 1 }
  ];
  function measure(key) { return MEASURES.filter(function (m) { return m.key === key; })[0]; }

  // The difference between the selected and baseline location for one measure.
  function difference(sel, base, m) {
    if (!sel) { return { text: '—', note: '' }; }
    if (sel.id === base.id) { return { text: 'Same location', note: '' }; }
    if (core && core.distanceKm(sel, base) < core.NEAR_KM) {
      return {
        text: 'Not shown',
        note: sel.name + ' and ' + base.name + ' are only about ' + Math.max(1, Math.round(core.distanceKm(sel, base))) +
          ' km apart. The climate model works on a grid of about ' + core.NEAR_KM + ' km, so it cannot reliably tell them apart.'
      };
    }
    if (!isNum(sel[m.key]) || !isNum(base[m.key])) { return { text: 'No data', note: '' }; }
    var diff = Number((sel[m.key] - base[m.key]).toFixed(m.d)) || 0;
    if (diff === 0) { return { text: 'Same', note: '' }; }
    return { text: (diff > 0 ? '+' : '-') + Math.abs(diff).toFixed(m.d) + ' ' + m.unit, note: '' };
  }

  // ---------- charts ----------
  function box(chart, fallbackH) {
    var r = chart.getBoundingClientRect();
    return {
      w: Math.max(260, Math.round(r.width) || 480),
      h: isDesktop() && r.height >= 60 ? Math.round(r.height) : fallbackH
    };
  }

  function niceRange(values, padRatio) {
    var lo = Math.min.apply(null, values), hi = Math.max.apply(null, values);
    if (lo === hi) { lo -= 1; hi += 1; }
    var pad = (hi - lo) * padRatio;
    return [Math.floor(lo - pad), Math.ceil(hi + pad)];
  }

  // A line chart for the baseline (dashed, square markers) and the selected location (solid, round markers).
  function lineChart(chart, cats, seriesList, fallbackH, aria) {
    chart.replaceChildren();
    var all = [];
    seriesList.forEach(function (s) { s.values.forEach(function (v) { if (isNum(v)) { all.push(v); } }); });
    if (!all.length) { chart.setAttribute('aria-label', 'No data to chart'); return false; }
    var b = box(chart, fallbackH), W = b.w, H = b.h;
    var left = 40, right = 10, top = 10, bottom = 20;
    var range = niceRange(all, 0.12), lo = range[0], hi = range[1];
    var n = cats.length;
    var x = function (i) { return left + (W - left - right) * (n === 1 ? 0.5 : i / (n - 1)); };
    var y = function (v) { return top + (H - top - bottom) * (1 - (v - lo) / (hi - lo)); };
    chart.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    [lo, (lo + hi) / 2, hi].forEach(function (t) {
      chart.append(svg('line', { x1: left, x2: W - right, y1: y(t), y2: y(t), 'class': 'ov-grid' }));
      chart.append(svg('text', { x: left - 5, y: y(t) + 3.5, 'text-anchor': 'end', 'class': 'ov-axis' }, (Math.round(t * 10) / 10) + '°'));
    });
    var step = Math.max(1, Math.ceil(n / Math.max(2, Math.floor((W - left - right) / 34))));
    cats.forEach(function (c, i) {
      if (i % step === 0 || i === n - 1 && step === 1) {
        chart.append(svg('text', { x: x(i), y: H - 5, 'text-anchor': 'middle', 'class': 'ov-axis' }, c));
      }
    });
    seriesList.forEach(function (s) {
      var path = '', on = false;
      s.values.forEach(function (v, i) {
        if (!isNum(v)) { on = false; return; }
        path += (on ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1) + ' ';
        on = true;
      });
      if (path) { chart.append(svg('path', { d: path, 'class': 'ov-line ' + s.cls })); }
      s.values.forEach(function (v, i) {
        if (!isNum(v)) { return; }
        var hollow = s.complete && s.complete[i] === false ? ' hollow' : '';
        var tip = svg('title', {}, s.name + ', ' + cats[i] + ': ' + v.toFixed(1) + (hollow ? ' (incomplete year)' : ''));
        var dot = s.square
          ? svg('rect', { x: (x(i) - 3.2).toFixed(1), y: (y(v) - 3.2).toFixed(1), width: 6.4, height: 6.4, 'class': 'ov-dot ' + s.cls + hollow })
          : svg('circle', { cx: x(i).toFixed(1), cy: y(v).toFixed(1), r: 3.6, 'class': 'ov-dot ' + s.cls + hollow });
        dot.append(tip);
        chart.append(dot);
      });
    });
    chart.setAttribute('aria-label', aria);
    return true;
  }

  // Grouped bars: baseline (hatched) and selected (solid) for each season, with the value above each bar.
  function barChart(chart, cats, seriesList, fallbackH, aria) {
    chart.replaceChildren();
    var all = [];
    seriesList.forEach(function (s) { s.values.forEach(function (v) { if (isNum(v)) { all.push(v); } }); });
    if (!all.length) { chart.setAttribute('aria-label', 'No data to chart'); return false; }
    var b = box(chart, fallbackH), W = b.w, H = b.h;
    var left = 34, right = 8, top = 16, bottom = 20;
    var hi = Math.ceil(Math.max.apply(null, all) / 5) * 5 || 5;
    var y = function (v) { return top + (H - top - bottom) * (1 - v / hi); };
    chart.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    var defs = svg('defs');
    var pat = svg('pattern', { id: 'hc-hatch', width: 5, height: 5, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' });
    pat.append(svg('rect', { width: 5, height: 5, fill: '#5fd0c8' }), svg('rect', { width: 2, height: 5, fill: '#10353a' }));
    defs.append(pat);
    chart.append(defs);
    [0, hi / 2, hi].forEach(function (t) {
      chart.append(svg('line', { x1: left, x2: W - right, y1: y(t), y2: y(t), 'class': 'ov-grid' }));
      chart.append(svg('text', { x: left - 5, y: y(t) + 3.5, 'text-anchor': 'end', 'class': 'ov-axis' }, String(Math.round(t * 10) / 10)));
    });
    var groupW = (W - left - right) / cats.length;
    var barW = Math.min(30, groupW / 3);
    cats.forEach(function (c, i) {
      var cx = left + groupW * (i + 0.5);
      chart.append(svg('text', { x: cx, y: H - 5, 'text-anchor': 'middle', 'class': 'ov-axis' }, c));
      seriesList.forEach(function (s, k) {
        var v = s.values[i];
        var bx = cx + (k === 0 ? -barW - 2 : 2);
        if (!isNum(v)) {
          chart.append(svg('text', { x: bx + barW / 2, y: y(0) - 4, 'text-anchor': 'middle', 'class': 'ov-axis' }, 'No data'));
          return;
        }
        var bar = svg('rect', { x: bx, y: y(v), width: barW, height: Math.max(1, y(0) - y(v)), 'class': 'ov-bar ' + s.cls, fill: s.cls === 'ov-base' ? 'url(#hc-hatch)' : '#ff9a5c' });
        bar.append(svg('title', {}, s.name + ', ' + c + ': ' + v.toFixed(1) + ' °C'));
        chart.append(bar);
        chart.append(svg('text', { x: bx + barW / 2, y: y(v) - 3, 'text-anchor': 'middle', 'class': 'ov-axis ov-value' }, v.toFixed(1)));
      });
    });
    chart.setAttribute('aria-label', aria);
    return true;
  }

  function valueTable(tbl, cats, seriesList, unit) {
    tbl.replaceChildren();
    var head = el('tr');
    head.append(Object.assign(el('th', 'Period'), { scope: 'col' }));
    seriesList.forEach(function (s) { head.append(Object.assign(el('th', s.name), { scope: 'col' })); });
    tbl.append(head);
    cats.forEach(function (c, i) {
      var row = el('tr');
      row.append(Object.assign(el('th', c), { scope: 'row' }));
      seriesList.forEach(function (s) {
        var v = s.values[i];
        var text = figure(v, 1, unit);
        if (isNum(v) && s.complete && s.complete[i] === false) { text += ' (incomplete year)'; }
        row.append(el('td', text));
      });
      tbl.append(row);
    });
  }

  // A short note when the selected location has nothing to draw in a chart.
  function emptyNote(sel, list) {
    if (!sel || !list.length) { return ''; }
    var mine = list[list.length - 1];
    return mine.values.some(isNum) ? '' : sel.name + ' has no data for this chart.';
  }

  function monthly(p) {
    var v = p && Array.isArray(p.monthly_average_max_c) ? p.monthly_average_max_c : [];
    return MONTHS.map(function (_m, i) { return isNum(v[i]) ? v[i] : null; });
  }

  function yearsOf(id) {
    var rec = historyById[id];
    return rec && Array.isArray(rec.years) ? rec.years : [];
  }

  function annualSeries(p, name, cls, square, years) {
    var rows = {};
    yearsOf(p.id).forEach(function (r) { rows[r.year] = r; });
    return {
      name: name, cls: cls, square: square,
      values: years.map(function (yr) { return rows[yr] && isNum(rows[yr].annual_mean_c) ? rows[yr].annual_mean_c : null; }),
      complete: years.map(function (yr) { return rows[yr] ? rows[yr].mean_days === rows[yr].expected_days : true; })
    };
  }

  function seasonSeries(p, name, cls) {
    var rec = seasonsById[p.id];
    var list = rec && Array.isArray(rec.seasons) ? rec.seasons : [];
    return {
      name: name, cls: cls,
      values: SEASONS.map(function (s) {
        var found = list.filter(function (x) { return x.season === s[0]; })[0];
        return found && isNum(found.typical_max) ? found.typical_max : null;
      })
    };
  }

  // ---------- Historical tab ----------
  function renderHistorical(sel, base) {
    setText('hc-selected-name', sel ? sel.name + ' · ' + sel.state : 'Choose a location');
    setText('hc-baseline-name', base.name + ' · ' + base.state);
    var body = $('hc-context-body');
    body.replaceChildren();
    MEASURES.filter(function (m) { return m.key !== 'hottest_10_percent_mean_c'; }).forEach(function (m) {
      var row = el('tr');
      row.append(Object.assign(el('th', m.label), { scope: 'row' }),
        el('td', sel ? figure(sel[m.key], m.d, m.unit) : '—', 'hc-sel'),
        el('td', figure(base[m.key], m.d, m.unit), 'hc-base'));
      body.append(row);
    });

    var selName = sel ? sel.name : 'Selected', baseName = base.name + ' (baseline)';
    var who = (sel ? sel.name + ' and ' : '') + base.name + ' (baseline)';

    var mSeries = [{ name: baseName, cls: 'ov-base', square: true, values: monthly(base) }];
    if (sel) { mSeries.push({ name: selName, cls: 'ov-selected', values: monthly(sel) }); }
    var okM = lineChart($('hc-monthly'), MONTHS, mSeries, 150, 'Average daily maximum temperature by month for ' + who + '.');
    setText('hc-monthly-status', okM ? emptyNote(sel, mSeries) : 'No monthly data for these locations.');
    valueTable($('hc-monthly-values'), MONTHS, mSeries, '°C');

    var yrs = {};
    [base, sel].forEach(function (p) { if (p) { yearsOf(p.id).forEach(function (r) { yrs[r.year] = true; }); } });
    var years = Object.keys(yrs).map(Number).sort();
    var aSeries = [annualSeries(base, baseName, 'ov-base', true, years)];
    if (sel) { aSeries.push(annualSeries(sel, selName, 'ov-selected', false, years)); }
    var okA = years.length ? lineChart($('hc-annual'), years.map(String), aSeries, 150, 'Annual mean temperature by year for ' + who + '. Hollow markers are incomplete years.') : false;
    if (!okA) { $('hc-annual').replaceChildren(); }
    var incomplete = aSeries.some(function (s) { return s.complete.some(function (c, i) { return c === false && isNum(s.values[i]); }); });
    var blanks = aSeries.some(function (s2) { return s2.values.some(function (v) { return !isNum(v); }); });
    var annualNote = !years.length ? 'Yearly data is unavailable right now.' : !okA ? 'No annual data for these locations.' :
      emptyNote(sel, aSeries) ||
      (incomplete ? 'Hollow marker = incomplete year (some days have no value).' : 'Every year shown has a value for every day.');
    if (okA && blanks) { annualNote += ' Years with no value are left blank.'; }
    setText('hc-annual-status', annualNote);
    valueTable($('hc-annual-values'), years.map(String), aSeries, '°C');

    var sCats = SEASONS.map(function (s) { return s[1]; });
    var sSeries = [seasonSeries(base, baseName, 'ov-base')];
    if (sel) { sSeries.push(seasonSeries(sel, selName, 'ov-selected')); }
    var okS = barChart($('hc-seasons'), sCats, sSeries, 150, 'Typical seasonal maximum temperature for ' + who + '.');
    setText('hc-seasons-status', okS ? emptyNote(sel, sSeries) : 'No seasonal data for these locations.');
    valueTable($('hc-seasons-values'), sCats, sSeries, '°C');

    var notes = [];
    var sum = $('hc-summary-body');
    sum.replaceChildren();
    MEASURES.filter(function (m) { return m.key !== 'hottest_10_percent_mean_c'; }).forEach(function (m) {
      var d = difference(sel, base, m);
      if (d.note && notes.indexOf(d.note) < 0) { notes.push(d.note); }
      var row = el('tr');
      row.append(Object.assign(el('th', m.label), { scope: 'row' }),
        el('td', sel ? figure(sel[m.key], m.d, m.unit) : '—'),
        el('td', figure(base[m.key], m.d, m.unit)),
        el('td', d.text));
      sum.append(row);
    });
    setText('hc-summary-sub', 'Selected ' + (sel ? sel.name : '—') + ' / Baseline ' + base.name);
    setText('hc-summary-note', notes.join(' '));

    var srcText = meta.model ? 'Source: ' + meta.source + ' (model: ' + meta.model + '), ' + meta.start + ' to ' + meta.end + '. ' : '';
    setText('hc-source', srcText + 'Values are modelled estimates, not weather station readings. The comparison uses the same period and units for both locations.');
    var tb = $('hc-table-body');
    tb.replaceChildren();
    [[sel, 'Selected', 'hc-sel'], [base, 'Baseline', 'hc-base']].forEach(function (item) {
      var row = el('tr');
      var th = Object.assign(el('th', item[0] ? item[0].name + ' (' + item[0].state + ')' : 'No location selected'), { scope: 'row' });
      th.className = item[2];
      row.append(th);
      MEASURES.forEach(function (m) { row.append(el('td', item[0] ? figure(item[0][m.key], m.d, m.unit) : '—')); });
      tb.append(row);
    });
  }

  // ---------- Compare tab ----------
  function renderCompare(sel, base) {
    setText('cp-selected-name', sel ? sel.name + ', ' + sel.state : 'Choose a location');
    setText('cp-baseline-name', base.name + ', ' + base.state);
    $('cp-swap').disabled = !sel;
    var cards = [
      ['cp-temp', 'annual_mean_c'], ['cp-rain', 'average_annual_rainfall_mm'],
      ['cp-heat', 'average_days_at_least_35c'], ['cp-extreme', 'hottest_10_percent_mean_c']
    ];
    var notes = [];
    cards.forEach(function (c) {
      var d = difference(sel, base, measure(c[1]));
      var node = $(c[0]);
      node.textContent = d.text;
      node.classList.toggle('is-empty', d.text === '—' || d.text === 'No data' || d.text === 'Not shown');
      if (d.note && notes.indexOf(d.note) < 0) { notes.push(d.note); }
    });
    setText('cp-sub', sel ? 'Differences are the selected location minus the baseline, ' + base.name + '.' : 'Choose a location to see how it differs from the baseline.');

    var body = $('cp-summary-body');
    body.replaceChildren();
    setText('cp-summary-sub', 'Selected ' + (sel ? sel.name : '—') + ' / Baseline ' + base.name);
    var result = null;
    if (core && sel && sel.id !== base.id) {
      result = core.compare([core.buildRecord(base, seasonsById[base.id]), core.buildRecord(sel, seasonsById[sel.id])], null);
    }
    var rows = core ? core.MEASURES : [];
    rows.forEach(function (m, i) {
      var tr = el('tr');
      tr.append(Object.assign(el('th', m.label), { scope: 'row' }));
      var rowData = result && result.rows[i];
      var selV = sel ? (rowData ? rowData.values[1] : core.buildRecord(sel, seasonsById[sel.id]).values[m.key]) : null;
      var baseV = rowData ? rowData.values[0] : core.buildRecord(base, seasonsById[base.id]).values[m.key];
      var diffText = '—';
      if (sel && sel.id === base.id) { diffText = 'Same location'; }
      else if (sel && result) {
        var near = result.nearby.length > 0;
        var dv = rowData.differences[1];
        diffText = near ? 'Not shown' : (!isNum(selV) || !isNum(baseV)) ? 'No data' : (core.formatDifference(dv, m.decimals, m.unit) === 'same' ? 'Same' : core.formatDifference(dv, m.decimals, m.unit));
      }
      tr.append(el('td', sel ? figure(selV, m.decimals, m.unit) : '—'), el('td', figure(baseV, m.decimals, m.unit)), el('td', diffText));
      body.append(tr);
    });

    var mSeries = [{ name: base.name + ' (baseline)', cls: 'ov-base', square: true, values: monthly(base) }];
    if (sel) { mSeries.push({ name: sel.name, cls: 'ov-selected', values: monthly(sel) }); }
    var ok = lineChart($('cp-monthly'), MONTHS, mSeries, 160, 'Average daily maximum temperature by month for ' + (sel ? sel.name + ' and ' : '') + base.name + ' (baseline).');
    setText('cp-monthly-status', ok ? emptyNote(sel, mSeries) : 'No monthly data for these locations.');
    valueTable($('cp-monthly-values'), MONTHS, mSeries, '°C');

    if (result) { result.notes.forEach(function (n) { if (notes.indexOf(n.text) < 0) { notes.push(n.text); } }); }
    var list = $('cp-notes');
    list.replaceChildren();
    notes.forEach(function (text) { list.append(el('li', text)); });
    var src = meta.model ? 'Source: ' + meta.source + ' (model: ' + meta.model + '), ' + meta.start + ' to ' + meta.end + '. ' : '';
    setText('cp-source', src + 'Both locations use the same period, units and model. Values are modelled estimates, not weather station readings.');
    
  }

  // ---------- keep the older detailed sections in step ----------
  function setSelect(id, wanted) {
    var node = $(id);
    if (!node || !wanted || node.value === wanted) { return; }
    if (!Array.prototype.some.call(node.options, function (o) { return o.value === wanted; })) { return; }
    node.value = wanted;
    node.dispatchEvent(new Event('change'));
  }
  function syncLegacy(sel, base) {
    var key = (sel ? sel.id : '') + '|' + base.id;
    if (key === legacyKey) { return; }
    legacyKey = key;
    if (sel) {
      setSelect('history-place', sel.id);
      setSelect('seasons-place', sel.id);
      if (sel.id !== base.id) { setSelect('compare-1', base.id); setSelect('compare-2', sel.id); }
    }
  }

  function render() {
    var base = pointById[baselineSelect.value];
    if (!base) { return; }
    var sel = pointById[place.value] || null;
    renderHistorical(sel, base);
    renderCompare(sel, base);
    syncLegacy(sel, base);
  }

  // Swap the selected and baseline locations.
  function swap() {
    var s = place.value, b = baselineSelect.value;
    if (!s || !b || s === b) { return; }
    if (!Array.prototype.some.call(place.options, function (o) { return o.value === b; }) && stateSelect) {
      stateSelect.value = 'ALL';
      stateSelect.dispatchEvent(new Event('change'));
    }
    place.value = b;
    place.dispatchEvent(new Event('change'));
    baselineSelect.value = s;
    baselineSelect.dispatchEvent(new Event('change'));
  }

  function watch() {
    var timer = null;
    window.addEventListener('resize', function () { clearTimeout(timer); timer = setTimeout(render, 150); });
    place.addEventListener('change', render);
    baselineSelect.addEventListener('change', render);
    var detail = $('detail');
    if (detail) { new MutationObserver(render).observe(detail, { childList: true, characterData: true, subtree: true }); }
    $('cp-swap').addEventListener('click', swap);
    Array.prototype.forEach.call(document.querySelectorAll('.legacy-detail'), function (d) {
      d.addEventListener('toggle', function () { window.dispatchEvent(new Event('resize')); });
    });
  }

  function getJson(url) {
    return fetch(url, { cache: 'no-store' }).then(function (r) { if (!r.ok) { throw new Error('missing'); } return r.json(); });
  }

  Promise.all([
    getJson('/static/national_data.json'),
    getJson('/static/national_history.json').catch(function () { return null; }),
    getJson('/static/national_seasons.json').catch(function () { return null; })
  ]).then(function (all) {
    var data = all[0];
    if (!Array.isArray(data.locations) || !data.locations.length) { throw new Error('empty'); }
    points = data.locations;
    points.forEach(function (p) { pointById[p.id] = p; });
    if (all[1] && Array.isArray(all[1].locations)) { all[1].locations.forEach(function (r) { historyById[r.id] = r; }); }
    if (all[2] && Array.isArray(all[2].locations)) { all[2].locations.forEach(function (r) { seasonsById[r.id] = r; }); }
    meta = { source: data.source || '', model: data.model || '', start: String(data.start_date || ''), end: String(data.end_date || '') };
    watch();
    // The baseline list is filled by overview_panel.js, so wait until it has options.
    var tries = 0;
    (function ready() {
      if (baselineSelect.options.length || tries > 40) { render(); return; }
      tries += 1;
      setTimeout(ready, 100);
    }());
  }).catch(function () {
    setText('hc-summary-note', 'Climate data is unavailable right now.');
    setText('cp-sub', 'Climate data is unavailable right now.');
  });
}());
