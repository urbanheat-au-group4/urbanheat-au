// Historical Trends chart.
// Reads /static/national_history.json (made by history_export.py) and draws an SVG line chart.
// Missing values are never filled in: they leave a gap, and incomplete years are labelled.
(function () {
  'use strict';

  const DATA_URL = '/static/national_history.json';
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const METRICS = {
    annual_mean_c: {label: 'Annual mean temperature', short: 'Annual mean', daysKey: 'mean_days',
                    colour: '#b5441f', dash: '', shape: 'circle'},
    average_max_c: {label: 'Average daily maximum', short: 'Average daily maximum', daysKey: 'max_days',
                    colour: '#1b5f7c', dash: '8 5', shape: 'square'}
  };

  const placeSelect = document.getElementById('history-place');
  const metricSelect = document.getElementById('history-metric');
  const chart = document.getElementById('history-chart');
  const summary = document.getElementById('history-summary');
  const legend = document.getElementById('history-legend');
  const limits = document.getElementById('history-limits');
  const tableBox = document.getElementById('history-table');
  const sourceNote = document.getElementById('history-source');
  if (!placeSelect || !metricSelect || !chart || !summary) return;

  let trends = null;

  function s(tag, attrs, text) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attrs || {})) node.setAttribute(key, String(value));
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function number(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  function selectedKeys() {
    return METRICS[metricSelect.value] ? [metricSelect.value] : Object.keys(METRICS);
  }

  // A year is complete for a measure only if every day of that year has a value.
  function isComplete(row, key) {
    return number(row[METRICS[key].daysKey]) === row.expected_days;
  }

  function daysWithData(row, key) {
    return number(row[METRICS[key].daysKey]) || 0;
  }

  function showMessage(text) {
    summary.textContent = text;
    chart.setAttribute('aria-label', text);
    chart.replaceChildren();
    chart.hidden = true;
    legend.replaceChildren();
    limits.textContent = '';
    tableBox.replaceChildren();
  }

  function drawChart(place, keys) {
    chart.hidden = false;
    chart.replaceChildren();
    const rows = place.years;
    const width = Math.max(300, Math.min(chart.getBoundingClientRect().width || 800, 1100));
    const small = width < 520;
    const height = small ? 320 : 420;
    chart.setAttribute('viewBox', `0 0 ${width} ${height}`);
    const margin = {left: small ? 46 : 62, right: 18, top: 20, bottom: small ? 56 : 64};
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const values = [];
    for (const row of rows) {
      for (const key of keys) {
        const v = number(row[key]);
        if (v !== null) values.push(v);
      }
    }
    if (!values.length) {
      chart.append(s('text', {x: width / 2, y: height / 2, 'text-anchor': 'middle', fill: '#33505f',
                              'font-size': 15}, 'No temperature data to show for this location.'));
      return;
    }

    let low = Math.floor(Math.min(...values) - 0.5);
    let high = Math.ceil(Math.max(...values) + 0.5);
    const step = high - low > 8 ? 2 : 1;
    high = low + Math.ceil((high - low) / step) * step;
    const yOf = v => margin.top + innerH * (1 - (v - low) / (high - low));
    const xOf = i => rows.length === 1
      ? margin.left + innerW / 2
      : margin.left + innerW * i / (rows.length - 1);

    // Horizontal grid lines and temperature labels
    for (let t = low; t <= high; t += step) {
      const y = yOf(t);
      chart.append(s('line', {x1: margin.left, x2: width - margin.right, y1: y, y2: y,
                              stroke: t === low ? '#6b8594' : '#c3d2d8', 'stroke-width': 1}));
      chart.append(s('text', {x: margin.left - 8, y: y + 4, 'text-anchor': 'end', fill: '#33505f',
                              'font-size': 12}, String(t)));
    }
    const midY = margin.top + innerH / 2;
    chart.append(s('text', {x: 14, y: midY, 'text-anchor': 'middle', fill: '#33505f', 'font-size': 12,
                            transform: `rotate(-90 14 ${midY})`}, 'Temperature (°C)'));
    chart.append(s('text', {x: margin.left + innerW / 2, y: height - 10, 'text-anchor': 'middle',
                            fill: '#33505f', 'font-size': 12}, 'Year'));

    // Year labels; * marks a year with missing days
    rows.forEach((row, i) => {
      if (small && i % 2 !== 0) return;
      const partial = keys.some(key => number(row[key]) !== null && !isComplete(row, key));
      chart.append(s('text', {x: xOf(i), y: height - margin.bottom + 20, 'text-anchor': 'middle',
                              fill: '#33505f', 'font-size': 12}, row.year + (partial ? '*' : '')));
    });

    // One line per measure. A missing value breaks the line instead of being guessed.
    for (const key of keys) {
      const cfg = METRICS[key];
      let path = '';
      let drawing = false;
      rows.forEach((row, i) => {
        const v = number(row[key]);
        if (v === null) { drawing = false; return; }
        path += `${drawing ? 'L' : 'M'}${xOf(i).toFixed(1)} ${yOf(v).toFixed(1)} `;
        drawing = true;
      });
      if (path) {
        chart.append(s('path', {d: path.trim(), fill: 'none', stroke: cfg.colour, 'stroke-width': 2.5,
                                'stroke-dasharray': cfg.dash || 'none', 'stroke-linejoin': 'round'}));
      }
      rows.forEach((row, i) => {
        const v = number(row[key]);
        if (v === null) return;
        const full = isComplete(row, key);
        const look = {fill: full ? cfg.colour : '#ffffff', stroke: cfg.colour, 'stroke-width': 2.5};
        const x = xOf(i), y = yOf(v);
        const marker = cfg.shape === 'circle'
          ? s('circle', Object.assign({cx: x, cy: y, r: 5.5}, look))
          : s('rect', Object.assign({x: x - 5, y: y - 5, width: 10, height: 10}, look));
        const note = full ? '' : ` (incomplete: based on ${daysWithData(row, key)} of ${row.expected_days} days)`;
        marker.append(s('title', {}, `${row.year}: ${cfg.short} ${v.toFixed(1)} °C${note}`));
        chart.append(marker);
      });
    }
  }

  function drawLegend(keys) {
    legend.replaceChildren();
    for (const key of keys) {
      const cfg = METRICS[key];
      const item = document.createElement('span');
      item.className = 'history-legend-item';
      const icon = s('svg', {width: 40, height: 14, viewBox: '0 0 40 14', 'aria-hidden': 'true', focusable: 'false'});
      icon.append(s('line', {x1: 2, x2: 38, y1: 7, y2: 7, stroke: cfg.colour, 'stroke-width': 2.5,
                             'stroke-dasharray': cfg.dash || 'none'}));
      icon.append(cfg.shape === 'circle'
        ? s('circle', {cx: 20, cy: 7, r: 5, fill: cfg.colour, stroke: cfg.colour, 'stroke-width': 2})
        : s('rect', {x: 15, y: 2, width: 10, height: 10, fill: cfg.colour, stroke: cfg.colour, 'stroke-width': 2}));
      item.append(icon, document.createTextNode(' ' + cfg.label));
      legend.append(item);
    }
    const partial = document.createElement('span');
    partial.className = 'history-legend-item';
    partial.textContent = 'Hollow marker and * = incomplete year (some days have no value)';
    legend.append(partial);
  }

  function describeLimits(place, keys) {
    const notes = [];
    if (!place.years.length) {
      limits.textContent = 'No yearly data is available for this location.';
      return;
    }
    for (const row of place.years) {
      for (const key of keys) {
        const label = METRICS[key].label.toLowerCase();
        if (number(row[key]) === null) {
          notes.push(`${row.year}: no ${label} available, so the year is left blank.`);
        } else if (!isComplete(row, key)) {
          notes.push(`${row.year}: ${label} uses ${daysWithData(row, key)} of ${row.expected_days} days.`);
        }
      }
    }
    limits.textContent = notes.length
      ? 'Data limits: ' + notes.join(' ')
      : 'Every year shown has a value for every day.';
  }

  function drawTable(place, keys) {
    tableBox.replaceChildren();
    const table = document.createElement('table');
    const caption = document.createElement('caption');
    caption.textContent = `${place.name} yearly temperatures (°C)`;
    table.append(caption);
    const headRow = document.createElement('tr');
    for (const label of ['Year', ...keys.map(k => METRICS[k].label + ' (°C)'), 'Data']) {
      const th = document.createElement('th');
      th.scope = 'col';
      th.textContent = label;
      headRow.append(th);
    }
    const thead = document.createElement('thead');
    thead.append(headRow);
    table.append(thead);
    const body = document.createElement('tbody');
    for (const row of place.years) {
      const tr = document.createElement('tr');
      const year = document.createElement('th');
      year.scope = 'row';
      year.textContent = row.year;
      tr.append(year);
      const status = [];
      for (const key of keys) {
        const v = number(row[key]);
        const td = document.createElement('td');
        td.textContent = v === null ? 'No data' : v.toFixed(1);
        tr.append(td);
        if (v === null) status.push(`${METRICS[key].short}: no data`);
        else if (!isComplete(row, key)) status.push(`${METRICS[key].short}: ${daysWithData(row, key)} of ${row.expected_days} days`);
      }
      const last = document.createElement('td');
      last.textContent = status.length ? 'Incomplete. ' + status.join('; ') : 'Complete';
      tr.append(last);
      body.append(tr);
    }
    table.append(body);
    tableBox.append(table);
  }

  function render() {
    if (!trends) return;
    const place = trends.locations.find(l => l.id === placeSelect.value);
    if (!place) { showMessage('Choose a location to see its historical trend.'); return; }
    const keys = selectedKeys();
    const period = `${String(trends.start_date).slice(0, 4)}–${String(trends.end_date).slice(0, 4)}`;
    const measures = keys.map(k => METRICS[k].label).join(' and ');
    const text = `${place.name} (${place.state}), ${period}. ${measures}, in °C. Modelled estimates.`;
    summary.textContent = text;
    chart.setAttribute('aria-label', `Line chart. ${text} A data table follows the chart.`);
    drawChart(place, keys);
    drawLegend(keys);
    describeLimits(place, keys);
    drawTable(place, keys);
    if (sourceNote) {
      sourceNote.textContent = `Source: ${trends.source}` + (trends.model ? ` (model: ${trends.model})` : '') +
        `. Period: ${period}. Units: °C. Values are modelled estimates, not weather station measurements.`;
    }
  }

  async function load() {
    try {
      const response = await fetch(DATA_URL, {cache: 'no-store'});
      if (!response.ok) throw new Error('not found');
      const data = await response.json();
      if (!data || !Array.isArray(data.locations) || !data.locations.length ||
          !data.locations.every(l => l && typeof l.id === 'string' && Array.isArray(l.years))) {
        throw new Error('invalid');
      }
      trends = data;
    } catch (error) {
      showMessage('Historical data is unavailable right now. Please try again later.');
      return;
    }
    placeSelect.replaceChildren();
    for (const place of trends.locations) placeSelect.add(new Option(`${place.name} (${place.state})`, place.id));
    const preferred = trends.locations.find(l => l.id === 'melbourne-cbd') || trends.locations[0];
    placeSelect.value = preferred.id;
    render();
  }

  placeSelect.addEventListener('change', render);
  metricSelect.addEventListener('change', render);
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(render, 150);
  });
  load();
})();