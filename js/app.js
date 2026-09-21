// UI del catálogo de Root's. La lógica de dinero y búsqueda vive en js/cart.js y js/search.js.
(function () {
  'use strict';

  var state = { products: [], category: 'todos', query: '', cart: {} };

  var $ = function (sel) { return document.querySelector(sel); };
  var money = RootsCart.money;

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var ICON_SEARCH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>';
  var ICON_CART = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4h2.4l2.2 10.2a1 1 0 0 0 1 .8h8.6a1 1 0 0 0 1-.8L20 8H6.2"/><circle cx="9.5" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/></svg>';

  // ---------- Datos ----------
  // Menú vivo (Vercel Blob) con respaldo estático si falla o tarda más de 3 s.
  function loadCatalog() {
    var fallback = window.ROOTS_PRODUCTS || [];
    if (!SITE_CONFIG.menuUrl || typeof fetch !== 'function') return Promise.resolve(fallback);
    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 3000);
    return fetch(SITE_CONFIG.menuUrl + '?t=' + Date.now(), ctrl ? { signal: ctrl.signal } : undefined)
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) { return j && Array.isArray(j.products) && j.products.length ? j.products : fallback; })
      .catch(function () { return fallback; })
      .then(function (list) { clearTimeout(timer); return list; });
  }

  // ---------- Render ----------
  function renderHeader() {
    $('#app-header').innerHTML =
      '<div class="header-in">' +
        '<a class="logo" href="./" aria-label="Root\'s, inicio"><img src="img/logo.svg" alt="Root\'s" width="140" height="44"></a>' +
        '<div class="search" role="search">' + ICON_SEARCH +
          '<input type="search" id="q" placeholder="Buscar producto o código" aria-label="Buscar producto" autocomplete="off" enterkeyhint="search">' +
        '</div>' +
        '<button class="cart-btn" id="cart-btn" type="button" aria-label="Ver mi pedido">' + ICON_CART +
          '<span>Mi pedido</span><span class="count" id="cart-count">0</span></button>' +
      '</div>';
  }

  function renderCats() {
    $('#app-cats').innerHTML = SITE_CONFIG.categorias.map(function (c) {
      return '<button type="button" class="cat" data-cat="' + esc(c.key) + '" aria-pressed="' + (c.key === state.category) + '">' + esc(c.label) + '</button>';
    }).join('');
  }

  function cardHtml(p) {
    var inCart = state.cart[p.code] || 0;
    var buy = p.soldOut
      ? '<button class="btn" type="button" disabled>No disponible</button>'
      : '<div class="stepper">' +
          '<button type="button" data-act="minus" aria-label="Menos">−</button>' +
          '<input class="qty" type="text" inputmode="numeric" pattern="[0-9]*" value="1" maxlength="3" aria-label="Cantidad de ' + esc(p.name) + '">' +
          '<button type="button" data-act="plus" aria-label="Más">+</button>' +
        '</div>' +
        '<button class="btn add" type="button" data-act="add">Agregar</button>' +
        '<p class="in-cart" data-in-cart>' + (inCart ? 'En tu pedido: ' + inCart : '') + '</p>';
    return '<article class="card' + (p.soldOut ? ' sold-out' : '') + '" data-code="' + p.code + '" role="listitem">' +
      (p.soldOut ? '<span class="badge-sold">Agotado</span>' : '') +
      '<div class="card-img"><img src="' + esc(p.image) + '" alt="' + esc(p.name + ' ' + p.presentation) + '" width="640" height="640" ' + (state._eager-- > 0 ? '' : 'loading="lazy" ') + 'decoding="async"></div>' +
      '<h3 class="card-name">' + esc(p.name) + '</h3>' +
      '<p class="card-pres">' + esc(p.presentation) + '</p>' +
      '<p class="price">' + money(p.price) + ' <small>c/u</small></p>' +
      '<div class="card-buy">' + buy + '</div>' +
    '</article>';
  }

  function gridHtml(list) {
    return '<div class="grid" role="list">' + list.map(cardHtml).join('') + '</div>';
  }

  function renderGrid() {
    var list = RootsSearch.filterProducts(state.products, state);
    var grid = $('#app-grid');
    state._eager = 8;
    if (!list.length) {
      grid.innerHTML = '<div class="empty"><p>No encontramos productos con esa búsqueda.</p>' +
        '<button type="button" class="btn" data-act="reset">Ver todos los productos</button></div>';
      return;
    }
    if (state.category === 'todos' && !state.query.trim()) {
      grid.innerHTML = SITE_CONFIG.categorias.filter(function (c) { return c.key !== 'todos'; }).map(function (c) {
        var items = list.filter(function (p) { return p.category === c.key; });
        return items.length ? '<h2 class="section-title">' + esc(c.label) + '</h2>' + gridHtml(items) : '';
      }).join('');
    } else {
      grid.innerHTML = '<p class="count-line" aria-live="polite">' + list.length + (list.length === 1 ? ' producto' : ' productos') + '</p>' + gridHtml(list);
    }
  }

  function renderFooter() {
    var c = SITE_CONFIG.contacto;
    $('#app-footer').innerHTML =
      '<div class="footer-in">' +
        '<h2>¿Necesitas ayuda con tu pedido?</h2>' +
        '<div class="footer-links">' +
          '<a href="https://wa.me/' + SITE_CONFIG.whatsapp + '" target="_blank" rel="noopener">WhatsApp ' + esc(c.telefono) + '</a>' +
          '<a href="mailto:' + esc(c.correo) + '">' + esc(c.correo) + '</a>' +
        '</div>' +
        '<div class="footer-links">' +
          '<a href="' + esc(c.instagram) + '" target="_blank" rel="noopener">Instagram</a>' +
          '<a href="' + esc(c.facebook) + '" target="_blank" rel="noopener">Facebook</a>' +
          '<a href="' + esc(c.tiktok) + '" target="_blank" rel="noopener">TikTok</a>' +
          '<a href="' + esc(c.web) + '" target="_blank" rel="noopener">foodsroots.com</a>' +
        '</div>' +
        '<p class="footer-note">Precios por unidad, ISV incluido.</p>' +
      '</div>';
  }

  // ---------- Eventos ----------
  function debounce(fn, ms) {
    var t; return function () { var a = arguments; clearTimeout(t); t = setTimeout(function () { fn.apply(null, a); }, ms); };
  }

  function bind() {
    $('#q').addEventListener('input', debounce(function (e) {
      state.query = e.target.value; renderGrid();
    }, 120));

    $('#app-cats').addEventListener('click', function (e) {
      var b = e.target.closest('.cat'); if (!b) return;
      state.category = b.getAttribute('data-cat'); renderCats(); renderGrid();
    });

    $('#app-grid').addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]'); if (!b) return;
      var act = b.getAttribute('data-act');
      if (act === 'reset') {
        state.category = 'todos'; state.query = ''; $('#q').value = ''; renderCats(); renderGrid(); return;
      }
      var card = b.closest('.card'); if (!card) return;
      var input = card.querySelector('.qty');
      if (act === 'minus') input.value = RootsCart.clampQty(Number(input.value) - 1);
      else if (act === 'plus') input.value = RootsCart.clampQty(Number(input.value) + 1);
      else if (act === 'add' && state.onAdd) state.onAdd(Number(card.getAttribute('data-code')), RootsCart.clampQty(input.value));
    });

    $('#app-grid').addEventListener('change', function (e) {
      if (e.target.classList.contains('qty')) e.target.value = RootsCart.clampQty(e.target.value);
    });

    window.addEventListener('scroll', function () {
      document.body.classList.toggle('scrolled', window.scrollY > 8);
    }, { passive: true });
  }

  // ---------- Carrito ----------
  var CART_KEY = 'roots_cart_v1';
  var CUSTOMER_KEY = 'roots_customer';
  var memoryStore = {};       // respaldo si localStorage no está disponible
  var cartOpen = false;
  var lastFocus = null;

  function store(op, key, val) {
    try {
      if (op === 'get') return window.localStorage.getItem(key);
      window.localStorage.setItem(key, val);
    } catch (e) {
      if (op === 'get') return memoryStore[key] || null;
      memoryStore[key] = val;
    }
    return null;
  }

  // Los precios nunca se leen del almacenamiento: solo códigos y cantidades, validados contra el catálogo vigente.
  function loadCart() {
    var parsed = null;
    try { parsed = JSON.parse(store('get', CART_KEY) || 'null'); } catch (e) { parsed = null; }
    state.cart = RootsCart.sanitizeCart(parsed, state.products);
  }
  function saveCart() { store('set', CART_KEY, JSON.stringify(state.cart)); }

  function cartInfo() {
    var lines = RootsCart.cartLines(state.cart, state.products);
    return { lines: lines, total: RootsCart.cartTotal(lines), count: RootsCart.cartCount(state.cart) };
  }

  function setQty(code, qty) {
    if (qty <= 0) delete state.cart[code]; else state.cart[code] = RootsCart.clampQty(qty);
    saveCart(); updateCartUI();
  }

  function addToCart(code, qty) {
    setQty(code, RootsCart.clampQty((state.cart[code] || 0) + qty));
    var card = document.querySelector('.card[data-code="' + code + '"]');
    var btn = card && card.querySelector('.add');
    if (btn) {
      btn.textContent = '¡Agregado!';
      setTimeout(function () { btn.textContent = 'Agregar'; }, 1000);
      card.querySelector('.qty').value = 1;
    }
  }

  function buildCartShell() {
    $('#app-cart').innerHTML =
      '<button class="fab" id="cart-fab" type="button" hidden>' + ICON_CART +
        '<span class="fab-count" id="fab-count"></span><span class="fab-total" id="fab-total"></span></button>' +
      '<div class="cart-overlay" id="cart-overlay" hidden></div>' +
      '<aside class="cart-panel" id="cart-panel" role="dialog" aria-modal="true" aria-labelledby="cart-title" hidden>' +
        '<div class="cart-head"><h2 id="cart-title">Mi pedido</h2>' +
          '<button type="button" class="cart-close" id="cart-close">Cerrar ✕</button></div>' +
        '<div class="cart-body" id="cart-lines"></div>' +
        '<div class="cart-foot" id="cart-foot">' +
          '<div class="cart-total"><span>Total</span><strong id="cart-total"></strong></div>' +
          '<label for="customer">Tu nombre o el de tu negocio</label>' +
          '<input id="customer" type="text" autocomplete="organization" placeholder="Ej: Restaurante El Sabor" maxlength="80">' +
          '<p class="field-error" id="customer-error" role="alert" hidden>Escribe tu nombre o el de tu negocio para enviar el pedido.</p>' +
          '<button class="btn send" id="cart-send" type="button">Enviar pedido por WhatsApp</button>' +
          '<p class="cart-note">Precios por unidad, ISV incluido. Root\'s confirmará tu pedido por WhatsApp.</p>' +
        '</div>' +
      '</aside>';
  }

  function renderCartLines(info) {
    var body = $('#cart-lines');
    $('#cart-foot').hidden = !info.lines.length;
    if (!info.lines.length) {
      body.innerHTML = '<div class="cart-empty"><p>Tu pedido está vacío.</p>' +
        '<button type="button" class="btn" data-cart="close">Ver productos</button></div>';
      return;
    }
    body.innerHTML = info.lines.map(function (l) {
      var p = l.product;
      return '<div class="line" data-code="' + p.code + '">' +
        '<img src="' + esc(p.image) + '" alt="" width="64" height="64">' +
        '<div class="line-info"><b>' + esc(p.name) + '</b><span>' + esc(p.presentation) + ' · ' + money(p.price) + ' c/u</span></div>' +
        '<div class="stepper small">' +
          '<button type="button" data-cart="minus" aria-label="Menos ' + esc(p.name) + '">−</button>' +
          '<input class="qty" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="3" value="' + l.qty + '" aria-label="Cantidad de ' + esc(p.name) + '">' +
          '<button type="button" data-cart="plus" aria-label="Más ' + esc(p.name) + '">+</button>' +
        '</div>' +
        '<div class="line-total">' + money(l.total) + '</div>' +
        '<button type="button" class="line-remove" data-cart="remove" aria-label="Quitar ' + esc(p.name) + '">Quitar</button>' +
      '</div>';
    }).join('');
    $('#cart-total').textContent = money(info.total);
  }

  function updateCartUI() {
    var info = cartInfo();
    $('#cart-count').textContent = info.count;
    var fab = $('#cart-fab');
    fab.hidden = info.count === 0;
    $('#fab-count').textContent = info.count;
    $('#fab-total').textContent = money(info.total);
    fab.setAttribute('aria-label', 'Ver mi pedido, ' + info.count + (info.count === 1 ? ' producto' : ' productos') + ', total ' + money(info.total));
    Array.prototype.forEach.call(document.querySelectorAll('.card[data-code]'), function (card) {
      var n = state.cart[card.getAttribute('data-code')] || 0;
      var el = card.querySelector('[data-in-cart]');
      if (el) el.textContent = n ? 'En tu pedido: ' + n : '';
    });
    if (cartOpen) renderCartLines(info);
  }

  function openCart() {
    if (cartOpen) return;
    cartOpen = true; lastFocus = document.activeElement;
    $('#cart-overlay').hidden = false; $('#cart-panel').hidden = false;
    document.body.classList.add('no-scroll');
    updateCartUI();
    var c = $('#customer');
    if (!c.value) c.value = store('get', CUSTOMER_KEY) || '';
    $('#cart-close').focus();
  }

  function closeCart() {
    if (!cartOpen) return;
    cartOpen = false;
    $('#cart-overlay').hidden = true; $('#cart-panel').hidden = true;
    document.body.classList.remove('no-scroll');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function sendOrder() {
    var input = $('#customer');
    var name = input.value.trim();
    var err = $('#customer-error');
    if (!name) { err.hidden = false; input.focus(); return; }
    err.hidden = true;
    var info = cartInfo();
    if (!info.lines.length) return;
    store('set', CUSTOMER_KEY, name);
    var msg = RootsCart.buildMessage(info.lines, info.total, name);
    window.open(RootsCart.whatsappUrl(SITE_CONFIG.whatsapp, msg), '_blank', 'noopener');
  }

  function bindCart() {
    state.onAdd = addToCart;
    $('#cart-btn').addEventListener('click', openCart);
    $('#cart-fab').addEventListener('click', openCart);
    $('#cart-close').addEventListener('click', closeCart);
    $('#cart-overlay').addEventListener('click', closeCart);
    $('#cart-send').addEventListener('click', sendOrder);
    $('#customer').addEventListener('input', function () { $('#customer-error').hidden = true; });

    $('#cart-lines').addEventListener('click', function (e) {
      var b = e.target.closest('[data-cart]'); if (!b) return;
      var act = b.getAttribute('data-cart');
      if (act === 'close') { closeCart(); return; }
      var line = b.closest('.line'); if (!line) return;
      var code = Number(line.getAttribute('data-code'));
      var cur = state.cart[code] || 1;
      if (act === 'minus') setQty(code, RootsCart.clampQty(cur - 1));
      else if (act === 'plus') setQty(code, RootsCart.clampQty(cur + 1));
      else if (act === 'remove') setQty(code, 0);
      var again = document.querySelector('.line[data-code="' + code + '"] [data-cart="' + act + '"]');
      if (again) again.focus(); else $('#cart-close').focus();
    });
    $('#cart-lines').addEventListener('change', function (e) {
      if (!e.target.classList.contains('qty')) return;
      var line = e.target.closest('.line');
      setQty(Number(line.getAttribute('data-code')), RootsCart.clampQty(e.target.value));
    });

    document.addEventListener('keydown', function (e) {
      if (!cartOpen) return;
      if (e.key === 'Escape') { closeCart(); return; }
      if (e.key !== 'Tab') return;
      var f = Array.prototype.filter.call($('#cart-panel').querySelectorAll('button, input, a[href]'), function (el) {
        return !el.disabled && el.offsetParent !== null;
      });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }

  // ---------- Inicio ----------
  renderHeader(); renderCats(); renderFooter(); buildCartShell(); bind(); bindCart();
  loadCatalog().then(function (list) {
    state.products = list.slice().sort(function (a, b) { return a.code - b.code; });
    loadCart();
    renderGrid();
    updateCartUI();
  });

  window.RootsApp = { state: state, renderGrid: renderGrid, esc: esc };
})();
