// Lógica pura del carrito: sin DOM ni almacenamiento. Se usa en el navegador (RootsCart) y en Node (tests).
(function (root) {
  var MAX_QTY = 999;

  function money(n) {
    var fixed = (Math.round(n * 100) / 100).toFixed(2);
    var parts = fixed.split('.');
    return 'L ' + parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + parts[1];
  }

  // Importe de una línea en centavos enteros para evitar errores de coma flotante.
  function lineTotal(price, qty) {
    return (Math.round(price * 100) * qty) / 100;
  }

  function clampQty(q) {
    var n = Math.floor(Number(q));
    if (!isFinite(n) || n < 1) return 1;
    return n > MAX_QTY ? MAX_QTY : n;
  }

  // Deja solo productos que existen y no están agotados; cantidades siempre acotadas.
  function sanitizeCart(state, products) {
    var out = {};
    if (!state || typeof state !== 'object') return out;
    var byCode = {};
    products.forEach(function (p) { byCode[p.code] = p; });
    Object.keys(state).forEach(function (k) {
      var p = byCode[Number(k)];
      if (!p || p.soldOut) return;
      out[p.code] = clampQty(state[k]);
    });
    return out;
  }

  function cartLines(state, products) {
    return products
      .filter(function (p) { return state[p.code] > 0; })
      .sort(function (a, b) { return a.code - b.code; })
      .map(function (p) {
        var qty = state[p.code];
        return { product: p, qty: qty, total: lineTotal(p.price, qty) };
      });
  }

  function cartTotal(lines) {
    var cents = 0;
    lines.forEach(function (l) { cents += Math.round(l.total * 100); });
    return cents / 100;
  }

  function cartCount(state) {
    var n = 0;
    Object.keys(state).forEach(function (k) { n += state[k]; });
    return n;
  }

  function buildMessage(lines, total, customer) {
    var out = ["Hola Root's, quiero hacer este pedido:", ''];
    lines.forEach(function (l) {
      out.push('• ' + l.qty + ' × ' + l.product.name + ' ' + l.product.presentation +
        ' — ' + money(l.product.price) + ' c/u = ' + money(l.total));
    });
    out.push('', 'TOTAL: ' + money(total) + ' (precios con ISV incluido)', 'Cliente: ' + customer);
    return out.join('\n');
  }

  function whatsappUrl(number, message) {
    return 'https://wa.me/' + number + '?text=' + encodeURIComponent(message);
  }

  var api = {
    MAX_QTY: MAX_QTY, money: money, lineTotal: lineTotal, clampQty: clampQty,
    sanitizeCart: sanitizeCart, cartLines: cartLines, cartTotal: cartTotal, cartCount: cartCount,
    buildMessage: buildMessage, whatsappUrl: whatsappUrl
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RootsCart = api;
})(typeof window !== 'undefined' ? window : globalThis);
