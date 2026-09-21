// Panel de administración: editar nombre, precio y "agotado" de los productos.
// La contraseña vive solo en memoria (nunca en localStorage) y se envía a la API en cada guardado.
(function () {
  'use strict';

  var $ = function (s) { return document.querySelector(s); };
  var password = '';
  var original = [];   // copia tal como llegó del servidor
  var rows = [];       // estado editable
  var canSave = false;

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function post(url, body) {
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, body: j }; }); });
  }

  // Menú vivo. Si hay menuUrl y no se puede leer, NO se permite guardar (evita pisar el menú con datos viejos).
  function loadMenu() {
    var fallback = window.ROOTS_PRODUCTS || [];
    if (!SITE_CONFIG.menuUrl) return Promise.resolve({ list: fallback, live: false });
    return fetch(SITE_CONFIG.menuUrl + '?t=' + Date.now())
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) {
        if (!j || !Array.isArray(j.products) || !j.products.length) throw new Error('menú vacío');
        return { list: j.products, live: true };
      })
      .catch(function () { return { list: fallback, live: false, error: true }; });
  }

  function priceValue(text) {
    var t = String(text).trim().replace(',', '.');
    if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
    var n = Number(t);
    return n <= 1000000 ? n : null;
  }

  function rowHtml(p) {
    return '<div class="arow" data-code="' + p.code + '">' +
      '<img src="' + esc(p.image) + '" alt="" width="56" height="56" loading="lazy">' +
      '<div class="afield aname"><label for="n' + p.code + '">#' + p.code + ' · ' + esc(p.presentation) + '</label>' +
        '<input id="n' + p.code + '" data-f="name" type="text" maxlength="120" value="' + esc(p.name) + '"></div>' +
      '<div class="afield aprice"><label for="p' + p.code + '">Precio (L)</label>' +
        '<input id="p' + p.code + '" data-f="price" type="text" inputmode="decimal" value="' + p.price.toFixed(2) + '"></div>' +
      '<label class="asold"><input type="checkbox" data-f="soldOut"' + (p.soldOut ? ' checked' : '') + '> Agotado</label>' +
    '</div>';
  }

  function render() {
    var q = $('#filter').value;
    var shown = RootsSearch.filterProducts(rows, { query: q, category: 'todos' });
    $('#list').innerHTML = shown.length ? shown.map(rowHtml).join('') : '<p class="empty">No hay productos con ese filtro.</p>';
  }

  function isDirty() {
    return rows.some(function (r, i) {
      var o = original[i];
      return r.name !== o.name || r.price !== o.price || r.soldOut !== o.soldOut;
    });
  }

  function refreshBar(message) {
    $('#save').disabled = !canSave || !isDirty() || !!document.querySelector('.arow .bad');
    if (message !== undefined) $('#status').textContent = message;
    else if (canSave) $('#status').textContent = isDirty() ? 'Hay cambios sin guardar.' : '';
  }

  function onEdit(e) {
    var input = e.target.closest('[data-f]');
    if (!input) return;
    var code = Number(input.closest('.arow').getAttribute('data-code'));
    var row = rows.filter(function (r) { return r.code === code; })[0];
    var f = input.getAttribute('data-f');
    if (f === 'soldOut') row.soldOut = input.checked;
    else if (f === 'name') {
      var name = input.value.trim();
      input.classList.toggle('bad', !name);
      if (name) row.name = name;
    } else if (f === 'price') {
      var v = priceValue(input.value);
      input.classList.toggle('bad', v === null);
      if (v !== null) row.price = v;
    }
    refreshBar();
  }

  function show(list, live, loadError) {
    original = list.slice().sort(function (a, b) { return a.code - b.code; })
      .map(function (p) { return { code: p.code, name: p.name, presentation: p.presentation, category: p.category, price: p.price, soldOut: !!p.soldOut, image: p.image }; });
    rows = original.map(function (p) { return Object.assign({}, p); });
    canSave = !loadError;
    var note = $('#admin-load-error');
    note.hidden = !loadError;
    if (loadError) note.textContent = 'No se pudo leer el menú actual, así que el guardado está desactivado para no borrar cambios. Recarga la página e inténtalo de nuevo.';
    render(); refreshBar();
  }

  function save() {
    var payload = rows.map(function (r) { return { code: r.code, name: r.name, presentation: r.presentation, category: r.category, price: r.price, soldOut: r.soldOut, image: r.image }; });
    $('#save').disabled = true; $('#status').textContent = 'Guardando…';
    post('/api/admin-save', { password: password, products: payload }).then(function (r) {
      if (r.status === 200) {
        original = rows.map(function (p) { return Object.assign({}, p); });
        refreshBar('Guardado ✓ Los cambios ya se ven en el catálogo.');
      } else if (r.status === 401) {
        password = ''; $('#panel').hidden = true; $('#login').hidden = false;
        $('#login-error').textContent = 'La sesión expiró. Escribe la contraseña de nuevo.'; $('#login-error').hidden = false;
      } else {
        refreshBar('No se pudo guardar: ' + (r.body.error || 'error ' + r.status));
        $('#save').disabled = false;
      }
    }).catch(function () { refreshBar('No se pudo conectar. Revisa tu internet e inténtalo de nuevo.'); $('#save').disabled = false; });
  }

  $('#login-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var pw = $('#pw').value;
    $('#login-btn').disabled = true; $('#login-error').hidden = true;
    post('/api/admin-login', { password: pw }).then(function (r) {
      $('#login-btn').disabled = false;
      if (r.status !== 200) { $('#login-error').textContent = 'Contraseña incorrecta.'; $('#login-error').hidden = false; return; }
      password = pw; $('#pw').value = '';
      return loadMenu().then(function (m) { $('#login').hidden = true; $('#panel').hidden = false; show(m.list, m.live, m.error); });
    }).catch(function () {
      $('#login-btn').disabled = false;
      $('#login-error').textContent = 'No se pudo conectar. Inténtalo de nuevo.'; $('#login-error').hidden = false;
    });
  });

  $('#list').addEventListener('input', onEdit);
  $('#list').addEventListener('change', onEdit);
  $('#filter').addEventListener('input', render);
  $('#save').addEventListener('click', save);
  window.addEventListener('beforeunload', function (e) { if (canSave && isDirty()) { e.preventDefault(); e.returnValue = ''; } });

  window.RootsAdmin = { priceValue: priceValue };
})();
