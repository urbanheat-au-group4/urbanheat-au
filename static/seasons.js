(function () {
  'use strict';

  var DATA_URL = '/static/national_seasons.json';
  var NS = 'http://www.w3.org/2000/svg';
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var COLOURS = { max: '#b5441f', min: '#1b5f7c' };

  var chart = document.getElementById('seasons-chart');
  var placeSelect = document.getElementById('seasons-place');
  if (!chart || !placeSelect) { return; }

  var summary = document.getElementById('seasons-summary');
  var legend = document.getElementById('seasons-legend');
  var limits = document.getElementById('seasons-limits');
  var table = document.getElementById('seasons-table');
  var yearsBox = document.getElementById('seasons-years');
  var sourceNote = document.getElementById('seasons-source');
  var data = null;

  if ('IntersectionObserver' in window) {
    var watcher = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) {
        chart.classList.add('seasons-visible');
        watcher.disconnect();
      }
    }, { threshold: 0.3 });
    watcher.observe(chart);
  } else {
    chart.classList.add('seasons-visible');
  }

  function s(value) {
    return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function isNum(value) { return typeof value === 'number' && isFinite(value); }
  function temp(value) { return isNum(value) ? value.toFixed(1) : null; }
  function rain(value) { return isNum(value) ? String(Math.round(value)) : null; }

  function prettyDate(iso) {
    var p = iso.split('-');
    return Number(p[2]) + ' ' + MONTHS[Number(p[1]) - 1] + ' ' + p[0];
  }
  function prettyPeriod(text) {
    var p = text.split(' to ');
    return prettyDate(p[0]) + ' to ' + prettyDate(p[1]);
  }
  function lowestDays(y) { return Math.min(y.max_days, y.min_days, y.precip_days); }
  function usedFor(y) {
    var used = [];
    if (y.max_days === y.expected_days) { used.push('maximum'); }
    if (y.min_days === y.expected_days) { used.push('minimum'); }
    if (y.precip_days === y.expected_days) { used.push('rainfall'); }
    return used;
  }

  function selectedPlace() {
    var id = placeSelect.value;
    for (var i = 0; i < data.locations.length; i += 1) {
      if (data.locations[i].id === id) { return data.locations[i]; }
    }
    return null;
  }

  function showMessage(text) {
    summary.textContent = text;
    chart.innerHTML = '';
    legend.innerHTML = '';
    limits.textContent = '';
    table.innerHTML = '';
    yearsBox.innerHTML = '';
  }

  function node(name, attrs, text) {
    var n = document.createElementNS(NS, name);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (text !== undefined) { n.textContent = text; }
    return n;
  }

  function drawChart(place, animate) {
    var width = Math.max(300, Math.round(chart.getBoundingClientRect().width) || 800);
    var small = width < 520;
    var height = small ? 340 : 380;
    var left = small ? 40 : 56;
    var right = 12;
    var top = 28;
    var bottom = 52;
    var plotW = width - left - right;
    var plotH = height - top - bottom;
    chart.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
    chart.innerHTML = '';

    var values = [];
    place.seasons.forEach(function (se) {
      if (isNum(se.typical_max)) { values.push(se.typical_max); }
      if (isNum(se.typical_min)) { values.push(se.typical_min); }
    });
    if (!values.length) {
      chart.appendChild(node('text', { x: width / 2, y: height / 2, 'text-anchor': 'middle', 'font-size': 14 },
        'No complete seasons, so there is nothing to chart.'));
      return;
    }
    var lo = Math.floor(Math.min(0, Math.min.apply(null, values)) / 5) * 5;
    var hi = Math.ceil(Math.max.apply(null, values) / 5) * 5;
    if (hi <= lo) { hi = lo + 5; }
    function y(v) { return top + plotH - ((v - lo) / (hi - lo)) * plotH; }

    for (var t = lo; t <= hi; t += 5) {
      chart.appendChild(node('line', { x1: left, x2: width - right, y1: y(t), y2: y(t),
        stroke: 'currentColor', 'stroke-opacity': t === 0 ? 0.6 : 0.2 }));
      chart.appendChild(node('text', { x: left - 6, y: y(t) + 4, 'text-anchor': 'end', 'font-size': 12 }, String(t)));
    }
    chart.appendChild(node('text', { x: 4, y: 14, 'font-size': 12 }, '°C'));

    var group = plotW / place.seasons.length;
    var barW = Math.min(46, group * 0.3);
    place.seasons.forEach(function (se, i) {
      var centre = left + group * i + group / 2;
      [['max', se.typical_max, 'maximum', -barW - 2], ['min', se.typical_min, 'minimum', 2]].forEach(function (b) {
        var key = b[0];
        var value = b[1];
        var x = centre + b[3];
        if (!isNum(value)) {
          chart.appendChild(node('text', { x: x + barW / 2, y: y(0) - 6, 'text-anchor': 'middle', 'font-size': 12 }, 'n/a'));
          return;
        }
        var y0 = y(0);
        var y1 = y(value);
        var bar = node('rect', { x: x, y: Math.min(y0, y1), width: barW, height: Math.max(1, Math.abs(y1 - y0)),
          fill: COLOURS[key], 'fill-opacity': key === 'min' ? 0.75 : 1,
          stroke: COLOURS[key], 'stroke-width': 2 });
        if (key === 'min') { bar.setAttribute('stroke-dasharray', '4 3'); }
        if (animate) { bar.setAttribute('class', value >= 0 ? 'seasons-bar seasons-bar-up' : 'seasons-bar seasons-bar-down'); }
        bar.appendChild(node('title', {}, se.label + ' typical ' + b[2] + ': ' + temp(value) + ' °C'));
        chart.appendChild(bar);
        chart.appendChild(node('text', { x: x + barW / 2, y: value >= 0 ? y1 - 5 : y1 + 15,
          'text-anchor': 'middle', 'font-size': 12 }, temp(value)));
      });
      chart.appendChild(node('text', { x: centre, y: height - 26, 'text-anchor': 'middle', 'font-size': small ? 12 : 14 }, se.label));
      chart.appendChild(node('text', { x: centre, y: height - 10, 'text-anchor': 'middle', 'font-size': 11 },
        small ? se.months.split(' to ').map(function (m) { return m.slice(0, 3); }).join('–') : se.months));
    });
  }

  function drawLegend() {
    legend.innerHTML =
      '<span><i style="background:' + COLOURS.max + '"></i>Typical maximum (solid bar)</span>' +
      '<span><i style="background:' + COLOURS.min + ';opacity:.75;border:2px dashed ' + COLOURS.min + '"></i>Typical minimum (dashed outline)</span>';
  }

  function drawTable(place) {
    var html = '<table><caption>Typical seasonal weather for ' + s(place.name) + '</caption>' +
      '<thead><tr><th scope="col">Season</th><th scope="col">Max (\u00b0C)</th>' +
      '<th scope="col">Min (\u00b0C)</th><th scope="col">Rain (mm)</th></tr></thead><tbody>';
    place.seasons.forEach(function (se) {
      function cell(text) {
        return text === null ? '<td class="seasons-na">Not enough data</td>' : '<td>' + text + '</td>';
      }
      var counts = [se.max_years.length, se.min_years.length, se.precip_years.length];
      var total = se.years.length;
      var yearsText = (counts[0] === counts[1] && counts[1] === counts[2])
        ? counts[0] + ' of ' + total + ' years used'
        : 'years used: max ' + counts[0] + ', min ' + counts[1] + ', rain ' + counts[2] + ' of ' + total;
      html += '<tr><th scope="row">' + s(se.label) + '<br><small>' + s(se.months) + '</small><br><small>' +
        s(yearsText) + '</small></th>' +
        cell(temp(se.typical_max)) + cell(temp(se.typical_min)) + cell(rain(se.typical_precip)) + '</tr>';
    });
    table.innerHTML = html + '</tbody></table>';
  }

  function drawLimits(place) {
    var notes = [];
    var left = [];
    place.seasons.forEach(function (se) {
      se.years.forEach(function (y) {
        if (usedFor(y).length < 3) {
          left.push(se.label + ' ' + y.season_year + ' (' + prettyPeriod(y.period) + ': ' +
            lowestDays(y) + ' of ' + y.expected_days + ' days)');
        }
      });
      [['max', 'maximum temperature'], ['min', 'minimum temperature'], ['precip', 'rainfall']].forEach(function (m) {
        if (se['typical_' + m[0]] === null) {
          notes.push(se.label + ' ' + m[1] + ' cannot be compared: no year has a value for every day.');
        }
      });
    });
    var text = '';
    if (left.length) {
      text += 'Incomplete seasons are not used for any measure they cannot fully support: ' +
        left.slice(0, 4).join('; ') +
        (left.length > 4 ? '; and ' + (left.length - 4) + ' more (see \u201cWhich years are included\u201d)' : '') + '. ';
    }
    text += notes.join(' ');
    limits.textContent = text.trim();
  }

  function drawYears(place) {
    var html = '';
    place.seasons.forEach(function (se) {
      html += '<h3>' + s(se.label) + ' (' + s(se.months) + ')</h3>';
      if (!se.years.length) {
        html += '<p class="seasons-na">No years recorded.</p>';
        return;
      }
      html += '<table><thead><tr><th scope="col">Season-year</th>' +
        '<th scope="col">Days with data</th><th scope="col">Used for</th></tr></thead><tbody>';
      se.years.forEach(function (y) {
        var used = usedFor(y);
        var same = y.max_days === y.min_days && y.min_days === y.precip_days;
        var days = same ? y.max_days + ' of ' + y.expected_days
          : 'max ' + y.max_days + ', min ' + y.min_days + ', rain ' + y.precip_days + ' of ' + y.expected_days;
        html += '<tr' + (used.length ? '' : ' class="seasons-excluded"') + '><th scope="row">' +
          s(se.label) + ' ' + y.season_year + '<br><small>' + s(prettyPeriod(y.period)) + '</small></th><td>' + s(days) +
          '</td><td>' + (used.length ? s(used.join(', ')) : 'Not used') + '</td></tr>';
      });
      html += '</tbody></table>';
    });
    yearsBox.innerHTML = html;
  }

  function render() {
    var place = selectedPlace();
    if (!place || !Array.isArray(place.seasons) || !place.seasons.length) {
      showMessage('No seasonal data is available for this location.');
      return;
    }
    var period = data.start_date.slice(0, 4) + ' to ' + data.end_date.slice(0, 4);
    summary.textContent = place.name + ' (' + place.state + '), ' + period +
      '. Typical seasonal maximum and minimum temperatures in °C, and rainfall in mm. Modelled estimates.';
    var parts = place.seasons.map(function (se) {
      return se.label + ': maximum ' + (temp(se.typical_max) || 'not enough data') +
        ', minimum ' + (temp(se.typical_min) || 'not enough data');
    });
    chart.setAttribute('aria-label', 'Bar chart of typical seasonal temperatures in degrees Celsius for ' +
      place.name + '. ' + parts.join('. ') + '.');
    drawChart(place, true);
    drawLegend();
    drawTable(place);
    drawLimits(place);
    drawYears(place);
    sourceNote.textContent = 'Source: ' + data.source + ' (' + data.model + '), ' +
      prettyDate(data.start_date) + ' to ' + prettyDate(data.end_date) +
      '. Values are modelled estimates, not weather station readings. Summer is counted in the year it ends, ' +
      'so Summer 2016 is December 2015 to February 2016. ' + (data.note || '');
  }

  function load() {
    fetch(DATA_URL, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) { throw new Error('HTTP ' + r.status); }
      return r.json();
    }).then(function (json) {
      if (!json || !Array.isArray(json.locations) || !json.locations.length) {
        throw new Error('No locations');
      }
      data = json;
      placeSelect.innerHTML = data.locations.map(function (p) {
        return '<option value="' + s(p.id) + '">' + s(p.name) + ' (' + s(p.state) + ')</option>';
      }).join('');
      var preferred = data.locations.some(function (p) { return p.id === 'melbourne-cbd'; });
      placeSelect.value = preferred ? 'melbourne-cbd' : data.locations[0].id;
      render();
    }).catch(function () {
      showMessage('Seasonal data could not be loaded. Run py seasonal_export.py --data-dir data/national, then refresh.');
    });
  }

  placeSelect.addEventListener('change', function () { if (data) { render(); } });
  var timer = null;
  window.addEventListener('resize', function () {
    clearTimeout(timer);
    timer = setTimeout(function () {
      if (data) { var p = selectedPlace(); if (p && p.seasons && p.seasons.length) { drawChart(p); } }
    }, 150);
  });
  load();
}());