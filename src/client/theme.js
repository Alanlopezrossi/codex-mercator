// Runs in <head> before the first paint: applies the saved theme (dark by default) and marks that JS is available.
(function () {
  var d = document.documentElement;
  d.classList.add('js');
  try {
    var t = localStorage.getItem('cm-theme');
    if (t === 'light' || t === 'dark') d.setAttribute('data-theme', t);
    // Accessibility: text size (1 normal, 2 large, 3 extra large) and high contrast.
    var a = JSON.parse(localStorage.getItem('cm-a11y') || '{}');
    if (a.fs === '2' || a.fs === '3') d.setAttribute('data-fs', a.fs);
    if (a.hc) d.setAttribute('data-contrast', 'high');
  } catch (e) { /* storage blocked: dark theme */ }
})();
