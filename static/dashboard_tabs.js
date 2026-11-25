// UHA-112: switches between the Overview, Historical and Compare views.
(function () {
  'use strict';
  var TABS = ['overview', 'historical', 'compare'];
  var buttons = document.querySelectorAll('[data-tab-button]');

  function show(tab) {
    TABS.forEach(function (name) {
      document.getElementById('panel-' + name).hidden = name !== tab;
    });
    buttons.forEach(function (button) {
      var active = button.getAttribute('data-tab-button') === tab;
      button.classList.toggle('active', active);
      if (button.getAttribute('role') === 'tab') {
        button.setAttribute('aria-selected', active ? 'true' : 'false');
        button.tabIndex = active ? 0 : -1;
      } else if (active) {
        button.setAttribute('aria-current', 'page');
      } else {
        button.removeAttribute('aria-current');
      }
    });
    window.dispatchEvent(new CustomEvent('urbanheat:tab', { detail: { tab: tab } }));
    window.dispatchEvent(new Event('resize'));
    try { window.sessionStorage.setItem('urbanheat.tab', tab); } catch (error) { /* storage unavailable */ }
  }

  buttons.forEach(function (button) {
    button.addEventListener('click', function () {
      show(button.getAttribute('data-tab-button'));
    });
  });

  // Arrow keys, Home and End move between the top tabs.
  var tablist = document.querySelector('.tab-bar');
  tablist.addEventListener('keydown', function (event) {
    var current = TABS.indexOf(document.activeElement.getAttribute('data-tab-button'));
    if (current < 0) return;
    var next = current;
    if (event.key === 'ArrowRight') next = (current + 1) % TABS.length;
    else if (event.key === 'ArrowLeft') next = (current + TABS.length - 1) % TABS.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = TABS.length - 1;
    else return;
    event.preventDefault();
    show(TABS[next]);
    document.getElementById('tab-' + TABS[next]).focus();
  });

  var saved = 'overview';
  try { saved = window.sessionStorage.getItem('urbanheat.tab') || 'overview'; } catch (error) { /* storage unavailable */ }
  show(saved === 'historical' || saved === 'compare' ? saved : 'overview');
})();
(function () {
  // On wide screens the location card sits beside the map, so start it open.
  var card = document.getElementById('location-card');
  if (card && window.matchMedia('(min-width: 1101px)').matches) card.open = true;
})();