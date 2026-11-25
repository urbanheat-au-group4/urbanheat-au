// UHA-112: switches between the Overview, Historical and Compare views.
(function () {
  'use strict';
  var TABS = window.UrbanHeatState.TABS;
  var buttons = document.querySelectorAll('[data-tab-button]');
  var baseline = document.getElementById('baseline');
  var swap = document.getElementById('swap-locations');
  var currentTab = 'overview';
  var store;

  function notify(selection) {
    window.dispatchEvent(new CustomEvent('urbanheat:selection', {detail: selection}));
  }

  function show(tab) {
    if (!TABS.includes(tab)) return;
    currentTab = tab;
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
    document.querySelector('main').scrollTop = 0;
    if (store) store.selectTab(tab);
    else notify(null);
  }

  function init(locations, metric) {
    store = window.UrbanHeatState.newStore(locations, {tab: currentTab, metric: metric});
    locations.forEach(function (point) {
      baseline.add(new Option(point.name + ' (' + point.state + ')', point.id));
    });
    baseline.disabled = false;
    baseline.addEventListener('change', function () { store.selectBaseline(baseline.value); });
    swap.addEventListener('click', function () { store.swap(); });
    store.subscribe(function (selection) {
      baseline.value = selection.baselineId;
      for (var option of baseline.options) {
        option.disabled = !!selection.cityId && option.value === selection.cityId;
      }
      swap.disabled = !selection.cityId || !selection.baselineId;
      notify(selection);
    });
    return store;
  }

  window.UrbanHeatDashboard = {
    init: init,
    show: show,
    getState: function () { return store ? store.getState() : null; },
    getTab: function () { return currentTab; }
  };

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

  show('overview');
})();
(function () {
  // On wide screens the location card sits beside the map, so start it open.
  var card = document.getElementById('location-card');
  if (card && window.matchMedia('(min-width: 1101px)').matches) card.open = true;
})();
