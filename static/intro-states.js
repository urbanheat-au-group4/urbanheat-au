(function () {
  'use strict';

  var nav = document.getElementById('site-nav');
  var toggle = document.getElementById('nav-toggle');
  if (!nav || typeof STATES === 'undefined' || typeof focusState !== 'function') { return; }

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function closeMenu(returnFocus) {
    nav.classList.remove('open');
    if (toggle) {
      toggle.setAttribute('aria-expanded', 'false');
      toggle.textContent = 'Menu';
      if (returnFocus) { toggle.focus(); }
    }
  }

  function addButton(code, text, description) {
    var button = document.createElement('button');
    button.type = 'button';
    button.textContent = text;
    button.setAttribute('aria-label', description);
    button.addEventListener('click', function () {
      if (typeof points === 'undefined' || !points.length) { return; }
      closeMenu(false);
      focusState(code);
      var heading = document.getElementById('map-title');
      if (heading) {
        heading.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      }
    });
    nav.appendChild(button);
  }

  addButton('ALL', 'All Australia', 'Show all of Australia');
  Object.keys(STATES).forEach(function (code) {
    addButton(code, code, 'Explore ' + STATES[code]);
  });

  if (toggle) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.textContent = open ? 'Close' : 'Menu';
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && nav.classList.contains('open')) { closeMenu(true); }
    });
  }
}());