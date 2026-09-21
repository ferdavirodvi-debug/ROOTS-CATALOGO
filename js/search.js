// Búsqueda y filtrado puros (sin DOM).
(function (root) {
  function normalize(s) {
    return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  }

  function filterProducts(products, opts) {
    var q = normalize(opts && opts.query);
    var cat = (opts && opts.category) || 'todos';
    return products.filter(function (p) {
      if (cat !== 'todos' && p.category !== cat) return false;
      if (!q) return true;
      return normalize(p.name + ' ' + p.presentation + ' ' + p.code).indexOf(q) !== -1;
    });
  }

  var api = { normalize: normalize, filterProducts: filterProducts };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RootsSearch = api;
})(typeof window !== 'undefined' ? window : globalThis);
