(function () {
  'use strict';

  var box = document.getElementById('intro-tiles');
  if (!box) { return; }

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var TILES = [
    { label: 'Warmest', field: 'annual_mean_c', highest: true, decimals: 1, unit: '\u00b0C',
      about: 'Highest annual mean temperature' },
    { label: 'Coolest', field: 'annual_mean_c', highest: false, decimals: 1, unit: '\u00b0C',
      about: 'Lowest annual mean temperature' },
    { label: 'Wettest', field: 'average_annual_rainfall_mm', highest: true, decimals: 0, unit: 'mm',
      about: 'Highest average annual rainfall' },
    { label: 'Most hot days', field: 'average_days_at_least_35c', highest: true, decimals: 1, unit: 'days',
      about: 'Most days a year at 35 \u00b0C or above' }
  ];

  function num(value) {
    return typeof value === 'number' && isFinite(value) ? value : null;
  }

  // Missing values are skipped. They are never treated as zero.
  function best(list, field, highest) {
    var found = null;
    list.forEach(function (place) {
      var value = num(place[field]);
      if (value === null) { return; }
      if (found === null || (highest ? value > found.value : value < found.value)) {
        found = { place: place, value: value };
      }
    });
    return found;
  }

  function add(parent, tag, className, text) {
    var el = document.createElement(tag);
    el.className = className;
    el.textContent = text;
    parent.appendChild(el);
    return el;
  }

  function countUp(el, target, decimals) {
    var start = null;
    var duration = 2400;
    function step(now) {
      if (start === null) { start = now; }
      var progress = Math.min((now - start) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = (target * eased).toFixed(decimals);
      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        el.textContent = target.toFixed(decimals);
      }
    }
    requestAnimationFrame(step);
  }

  function build(data) {
    var counters = [];
    TILES.forEach(function (spec) {
      var result = best(data.locations, spec.field, spec.highest);
      var tile = document.createElement('div');
      tile.className = 'intro-tile';
      add(tile, 'span', 'intro-tile-label', spec.label);
      if (result === null) {
        add(tile, 'strong', 'intro-tile-place', 'Not available');
      } else {
        add(tile, 'strong', 'intro-tile-place', result.place.name + ' (' + result.place.state + ')');
        var value = add(tile, 'span', 'intro-tile-value', '');
        var number = document.createElement('span');
        number.textContent = result.value.toFixed(spec.decimals);
        value.appendChild(number);
        value.appendChild(document.createTextNode(' ' + spec.unit));
        counters.push({ el: number, target: result.value, decimals: spec.decimals });
      }
      add(tile, 'span', 'intro-tile-about', spec.about);
      box.appendChild(tile);
    });

    var period = String(data.start_date).slice(0, 4) + '\u2013' + String(data.end_date).slice(0, 4);
    add(box, 'small', 'intro-tiles-note', 'From the ' + data.locations.length +
      ' locations with data, ' + period + '. Modelled estimates, not weather station readings.');

    if (reduceMotion || !('IntersectionObserver' in window) || !counters.length) { return; }
    counters.forEach(function (c) {
      c.el.style.display = 'inline-block';
      c.el.style.minWidth = c.el.offsetWidth + 'px';
      c.el.style.textAlign = 'right';
      c.el.textContent = (0).toFixed(c.decimals);
    });
    var watcher = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) {
        counters.forEach(function (c) { countUp(c.el, c.target, c.decimals); });
        watcher.disconnect();
      }
    }, { threshold: 0.4 });
    watcher.observe(box);
  }

  fetch('/static/national_data.json', { cache: 'no-store' }).then(function (response) {
    if (!response.ok) { throw new Error('HTTP ' + response.status); }
    return response.json();
  }).then(function (data) {
    if (!data || !Array.isArray(data.locations) || !data.locations.length) { throw new Error('No locations'); }
    build(data);
  }).catch(function () {
    box.textContent = '';
  });
}());