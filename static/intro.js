(function () {
  'use strict';

  var counters = document.querySelectorAll('.intro .count');
  if (!counters.length) { return; }

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion || !('IntersectionObserver' in window)) { return; }

  function run(el) {
    var target = Number(el.getAttribute('data-count'));
    if (!isFinite(target)) { return; }
    var start = null;
    var duration = 2400;
    function step(now) {
      if (start === null) { start = now; }
      var progress = Math.min((now - start) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = String(Math.round(target * eased));
      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        el.textContent = String(target);
      }
    }
    requestAnimationFrame(step);
  }

  var watcher = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        run(entry.target);
        watcher.unobserve(entry.target);
      }
    });
  }, { threshold: 0.6 });

  counters.forEach(function (el) {
    el.style.minWidth = el.offsetWidth + 'px';
    el.textContent = '0';
    watcher.observe(el);
  });
}());