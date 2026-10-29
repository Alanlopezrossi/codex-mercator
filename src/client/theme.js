// Runs in <head> before the first paint: applies the saved theme (dark by default) and marks that JS is available.
(function () {
  var d = document.documentElement;
  d.classList.add('js');
  try {
    var t = localStorage.getItem('cm-theme');
    if (t === 'light' || t === 'dark') d.setAttribute('data-theme', t);
  } catch (e) { /* storage blocked: dark theme */ }
})();
