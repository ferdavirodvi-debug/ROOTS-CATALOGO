# Catálogo web Root's — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Catálogo web de 56 productos Root's con categorías, buscador, carrito persistente y envío del pedido por WhatsApp, más un panel admin para editar precios.

**Architecture:** Sitio estático sin build (HTML/CSS/JS plano) con la lógica de dinero y búsqueda en módulos puros testeables en Node, datos vivos en un `menu.json` de Vercel Blob (respaldo en `data/products.js`) y dos funciones serverless para el admin.

**Tech Stack:** HTML/CSS/JS vanilla, Node 24 (`node:test`), Python 3.12 (`openpyxl`, `Pillow`) para herramientas de datos/imágenes, `@vercel/blob`, Vercel.

**Spec:** `docs/superpowers/specs/2026-09-21-roots-catalogo-design.md`

## Global Constraints

- WhatsApp de pedidos: `50431910999` (+504 3191-0999). Moneda `L`. Precios **por unidad, ISV incluido**; la columna "UND POR CAJA" del Excel se ignora.
- 56 productos, códigos 1–56 = número de foto = código del Excel. Categorías (claves): `condimentos` (1–31), `salsas` (32–42), `sacos` (43–53), `conservas` (54–56). Nombres visibles: "Condimentos y especias", "Salsas y vinagres", "Sacos", "Conservas".
- Carrito en `localStorage` clave `roots_cart_v1`; cantidad entera 1–999; los precios **nunca** se leen del almacenamiento; se descartan códigos desconocidos o agotados.
- Base tipográfica 18 px; objetivos táctiles ≥ 48 px; contraste AA; `lang="es"`.
- Tipografía Glory (títulos/menú/precios) + Roboto (botones/texto pequeño). Colores: verde profundo `#2E7900`, verde vivo `#3AB54A`/`#6DB83C`, verde claro `#E6F2DE`/`#D0E7C1`, marrón `#43220A`, gris `#5C5C5C`, fondo blanco. Radios: tarjetas 25 px, píldoras 50 px.
- Animaciones 0.4–0.6 s, hovers 0.3 s, escalonado de tarjetas ≤ 40 ms c/u (tope 400 ms), **sin pantalla de carga**, respetar `prefers-reduced-motion`.
- Imágenes WebP, lado mayor 640 px, calidad ≈ 80; los PNG originales y el Excel quedan fuera del repo (`PRODUCTOS CATALOGO/` ignorada).
- Mensaje de WhatsApp con formato exacto del spec §6 (ver Task 3).
- Admin: `scrypt` + `timingSafeEqual`, `ADMIN_PASSWORD_HASH` = `salt:hash` en env de Vercel; la contraseña se entrega en el chat, nunca al repo ni a memoria.
- Un commit + push por tarea (`git push origin main`); pie de commit: `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`. Tras el push: `vercel --prod --yes`. Si `vercel` agrega líneas duplicadas a `.gitignore`: `git checkout .gitignore`.
- Rutas de trabajo con ruta absoluta: `C:\Users\ferna\Desktop\ROOTS CATALOGO` (Bash: `/c/Users/ferna/Desktop/ROOTS CATALOGO`).

## File Structure

```
index.html                 página del catálogo (shell + <script>)
admin.html                 panel admin
css/style.css              estilos del catálogo y del admin
js/config.js               SITE_CONFIG (whatsapp, moneda, menuUrl, categorías, contacto)
js/cart.js                 lógica pura: dinero, carrito, mensaje WhatsApp   (global RootsCart)
js/search.js               lógica pura: normalizar, filtrar                   (global RootsSearch)
js/app.js                  UI del catálogo y del carrito
js/admin.js                UI del panel admin
data/products.js           respaldo estático (window.ROOTS_PRODUCTS), generado
lib/auth.js                hashPassword / verifyPassword
lib/menu.js                validateMenu
api/admin-login.js         POST {password} -> 200/401
api/admin-save.js          POST {password, products} -> escribe menu.json en Blob
img/                       logo.svg, 1..56.webp, favicons
tools/build_data.py        Excel -> data/products.js
tools/optimize_images.py   PNG -> WebP
tools/make_hash.js         genera "salt:hash" para ADMIN_PASSWORD_HASH
tools/seed-blob.js         sube data/products.js como menu.json
tools/serve.js             servidor local estático (puerto 8099)
tests/*.test.js            node:test
package.json
```

---

### Task 1: Datos — Excel → `data/products.js`

**Files:**
- Create: `tools/build_data.py`, `data/products.js`
- Modify: `.gitignore` (nada nuevo; ya ignora `PRODUCTOS CATALOGO/`)

**Interfaces:**
- Produces: `window.ROOTS_PRODUCTS` = array de 56 objetos `{ code:int, name:string, presentation:string, category:'condimentos'|'salsas'|'sacos'|'conservas', price:number, image:'img/<code>.webp', soldOut:false }` ordenado por `code`.

- [ ] **Step 1: Escribir `tools/build_data.py`**

```python
"""Genera data/products.js desde el Excel de precios. Falla si algo falta."""
import json, re, sys
from pathlib import Path
import openpyxl

ROOT = Path(__file__).resolve().parent.parent
XLSX = ROOT / "PRODUCTOS CATALOGO" / "LISTADO DE PRODUCTOS CON PRECIO" / "LISTADO PRECIOS ROOTS.xlsx"
PHOTOS = ROOT / "PRODUCTOS CATALOGO" / "IMAGENES DE PRODUCTOS" / "FOTOS"
OUT = ROOT / "data" / "products.js"

# El Excel trae caracteres corruptos (U+FFFD). Se corrigen por palabra completa.
FIXES = {"GAL\ufffdN": "GALÓN", "JALAPE\ufffdO": "JALAPEÑO", "SALVADURE\ufffdO": "SALVADUREÑO"}
LOWER = {"de", "en", "y", "con", "del", "la"}
PRES_RE = re.compile(r"\s+(\d+(?:[./]\d+)?\s*(?:lb|g|oz|lts?)|gal[oó]n)\s*$", re.IGNORECASE)

def category(code):
    if code <= 31: return "condimentos"
    if code <= 42: return "salsas"
    if code <= 53: return "sacos"
    return "conservas"

def title(text):
    words = text.lower().split()
    return " ".join(w if (i and w in LOWER) else w.capitalize() for i, w in enumerate(words))

def pres(text):
    m = re.match(r"^(\d+(?:[./]\d+)?)\s*(lb|g|oz|lts?)$", text.strip(), re.IGNORECASE)
    if m: return f"{m.group(1)} {m.group(2).lower()}"
    return "1 galón" if text.lower().startswith("gal") else text

def main():
    ws = openpyxl.load_workbook(XLSX, data_only=True).active
    products = []
    for code, raw, _und_caja, price in (r[:4] for r in ws.iter_rows(values_only=True)):
        if not isinstance(code, (int, float)): continue
        raw = str(raw).strip()
        for bad, good in FIXES.items(): raw = raw.replace(bad, good)
        if "\ufffd" in raw: sys.exit(f"Caracter corrupto sin corregir en código {code}: {raw!r}")
        m = PRES_RE.search(raw)
        if not m: sys.exit(f"No se pudo extraer la presentación del código {code}: {raw!r}")
        name = title(raw[: m.start()])
        code = int(code)
        photo = PHOTOS / f"{code}.png"
        if not photo.exists(): sys.exit(f"Falta la foto {photo}")
        if price is None: sys.exit(f"Falta el precio del código {code}")
        products.append({"code": code, "name": name, "presentation": pres(m.group(1)),
                         "category": category(code), "price": round(float(price), 2),
                         "image": f"img/{code}.webp", "soldOut": False})
    products.sort(key=lambda p: p["code"])
    if [p["code"] for p in products] != list(range(1, 57)):
        sys.exit("Se esperaban exactamente los códigos 1..56")
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text("// Generado por tools/build_data.py desde el Excel de precios. No editar a mano.\n"
                   "window.ROOTS_PRODUCTS = " + json.dumps(products, ensure_ascii=False, indent=2) + ";\n",
                   encoding="utf-8")
    print(f"OK: {len(products)} productos -> {OUT}")

if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Ejecutar y revisar la salida a mano**

Run: `python tools/build_data.py` y luego `python -c "import re,json;t=open('data/products.js',encoding='utf-8').read();d=json.loads(t[t.index('['):t.rindex(']')+1]);[print(p['code'],p['name'],'|',p['presentation'],'|',p['price'],'|',p['category']) for p in d]"`
Expected: `OK: 56 productos`. Revisar las 56 líneas: sin `�`, nombres en formato "Ablandador de carne", presentaciones como `1 lb`, `1/2 lb`, `400 g`, `1 galón`, `2 lts`, `25 lb`, `25.4 oz`. Corregir `FIXES`/`PRES_RE` si alguna sale rara (p. ej. "Salsa De Ajo" debe ser "Salsa de ajo"). Verificar visualmente en la foto 55 si la etiqueta dice "Salvadureño" o "Salvadoreño" y ajustar el nombre si difiere.

- [ ] **Step 3: Commit**

```bash
cd "/c/Users/ferna/Desktop/ROOTS CATALOGO"
git add tools/build_data.py data/products.js
git commit -m "Genera data/products.js desde el Excel de precios"
git push origin main
```

---

### Task 2: Imágenes y logo

**Files:**
- Create: `tools/optimize_images.py`, `img/1.webp … img/56.webp`, `img/logo.svg`, `img/logo-white.svg`

**Interfaces:**
- Produces: `img/<code>.webp` (56 archivos, lado mayor ≤ 640 px) y `img/logo.svg`.

- [ ] **Step 1: Escribir `tools/optimize_images.py`**

```python
"""Convierte los PNG originales a WebP livianos (lado mayor 640 px, fondo blanco)."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "PRODUCTOS CATALOGO" / "IMAGENES DE PRODUCTOS" / "FOTOS"
DST = ROOT / "img"
MAX = 640

def main():
    DST.mkdir(exist_ok=True)
    total = 0
    for code in range(1, 57):
        im = Image.open(SRC / f"{code}.png")
        if im.mode in ("RGBA", "LA", "P"):
            im = im.convert("RGBA")
            bg = Image.new("RGB", im.size, (255, 255, 255))
            bg.paste(im, mask=im.split()[-1])
            im = bg
        else:
            im = im.convert("RGB")
        im.thumbnail((MAX, MAX), Image.LANCZOS)
        out = DST / f"{code}.webp"
        im.save(out, "WEBP", quality=80, method=6)
        total += out.stat().st_size
        print(f"{code}.webp {im.size} {out.stat().st_size // 1024} KB")
    print(f"Total: {total // 1024} KB")

if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Ejecutar y comprobar peso**

Run: `python tools/optimize_images.py | tail -5`
Expected: 56 archivos; total razonable (≈ 1.5–3 MB); ninguna imagen individual > 150 KB.

- [ ] **Step 3: Descargar los logos oficiales**

Run: `curl -sL https://foodsroots.com/wp-content/uploads/2024/03/LOGO2.svg -o img/logo.svg && curl -sL https://foodsroots.com/wp-content/uploads/2024/07/logo-white.svg -o img/logo-white.svg && head -c 200 img/logo.svg`
Expected: contenido que empieza con `<svg` (si empieza con `<html`, la descarga falló: reintentar con `-A "Mozilla/5.0"`).

- [ ] **Step 4: Revisar 4 fotos optimizadas a ojo (una por categoría)**

Leer `img/1.webp`, `img/32.webp`, `img/43.webp`, `img/54.webp` y confirmar que se ven bien y coinciden con el producto del código.

- [ ] **Step 5: Commit**

```bash
git add tools/optimize_images.py img
git commit -m "Agrega fotos WebP optimizadas y logos de Root's"
git push origin main
```

---

### Task 3: Lógica pura — carrito, mensaje y búsqueda (TDD)

**Files:**
- Create: `package.json`, `js/config.js`, `js/cart.js`, `js/search.js`, `tests/cart.test.js`, `tests/search.test.js`

**Interfaces:**
- Consumes: forma de producto de Task 1.
- Produces (globales en el navegador y `module.exports` en Node):
  - `RootsCart.MAX_QTY` = 999
  - `RootsCart.money(n:number) -> string` → `'L 1,350.00'`
  - `RootsCart.lineTotal(price:number, qty:number) -> number` (2 decimales, sin error de coma flotante)
  - `RootsCart.clampQty(q:any) -> int` 1..999, no numérico → 1
  - `RootsCart.sanitizeCart(state:object, products:Product[]) -> object` (`{ "12": 2 }`; descarta desconocidos y `soldOut`)
  - `RootsCart.cartLines(state, products) -> {product, qty, total}[]` (orden por `code`)
  - `RootsCart.cartTotal(lines) -> number`, `RootsCart.cartCount(state) -> int`
  - `RootsCart.buildMessage(lines, total, customer) -> string`
  - `RootsCart.whatsappUrl(number:string, message:string) -> string`
  - `RootsSearch.normalize(s) -> string`, `RootsSearch.filterProducts(products, {query, category}) -> Product[]`
  - `SITE_CONFIG` = `{ nombreMarca, whatsapp:'50431910999', moneda:'L', menuUrl:'', categorias:[{key,label}], contacto:{...} }`

- [ ] **Step 1: `package.json`**

```json
{
  "name": "roots-catalogo",
  "private": true,
  "version": "1.0.0",
  "scripts": { "test": "node --test tests/", "serve": "node tools/serve.js" },
  "dependencies": { "@vercel/blob": "^2.8.0" }
}
```

Run: `npm install`

- [ ] **Step 2: Escribir `tests/cart.test.js` (falla primero)**

```js
const test = require('node:test');
const assert = require('node:assert');
const C = require('../js/cart.js');

const P = [
  { code: 2, name: 'Achiote molido', presentation: '1 lb', price: 75, soldOut: false },
  { code: 12, name: 'Consomé de pollo', presentation: '1 lb', price: 30, soldOut: false },
  { code: 54, name: 'Repollo con remolacha', presentation: '25.4 oz', price: 118.25, soldOut: false },
  { code: 99, name: 'Agotado', presentation: '1 lb', price: 10, soldOut: true },
];

test('money formatea con miles y 2 decimales', () => {
  assert.strictEqual(C.money(150), 'L 150.00');
  assert.strictEqual(C.money(1350), 'L 1,350.00');
  assert.strictEqual(C.money(118.25), 'L 118.25');
});

test('lineTotal evita errores de coma flotante', () => {
  assert.strictEqual(C.lineTotal(118.25, 3), 354.75);
  assert.strictEqual(C.lineTotal(0.1, 3), 0.3);
});

test('clampQty acota 1..999 y sanea', () => {
  assert.strictEqual(C.clampQty(0), 1);
  assert.strictEqual(C.clampQty(-5), 1);
  assert.strictEqual(C.clampQty(1000), 999);
  assert.strictEqual(C.clampQty('7'), 7);
  assert.strictEqual(C.clampQty('abc'), 1);
  assert.strictEqual(C.clampQty(2.9), 2);
});

test('sanitizeCart descarta desconocidos y agotados y acota cantidades', () => {
  const out = C.sanitizeCart({ 2: 3, 12: 5000, 99: 1, 777: 2, 54: 'x' }, P);
  assert.deepStrictEqual(out, { 2: 3, 12: 999, 54: 1 });
});

test('sanitizeCart tolera entradas inválidas', () => {
  assert.deepStrictEqual(C.sanitizeCart(null, P), {});
  assert.deepStrictEqual(C.sanitizeCart('x', P), {});
});

test('cartLines ordena por código y calcula totales; cartTotal suma', () => {
  const lines = C.cartLines({ 54: 3, 2: 2 }, P);
  assert.deepStrictEqual(lines.map(l => [l.product.code, l.qty, l.total]), [[2, 2, 150], [54, 3, 354.75]]);
  assert.strictEqual(C.cartTotal(lines), 504.75);
  assert.strictEqual(C.cartCount({ 54: 3, 2: 2 }), 5);
});

test('buildMessage usa el formato exacto', () => {
  const lines = C.cartLines({ 2: 2, 12: 1 }, P);
  const msg = C.buildMessage(lines, C.cartTotal(lines), 'Restaurante Luna');
  assert.strictEqual(msg, [
    "Hola Root's, quiero hacer este pedido:",
    '',
    '• 2 × Achiote molido 1 lb — L 75.00 c/u = L 150.00',
    '• 1 × Consomé de pollo 1 lb — L 30.00 c/u = L 30.00',
    '',
    'TOTAL: L 180.00 (precios con ISV incluido)',
    'Cliente: Restaurante Luna',
  ].join('\n'));
});

test('whatsappUrl codifica el mensaje', () => {
  const url = C.whatsappUrl('50431910999', 'Hola & adiós\nL 1');
  assert.strictEqual(url, 'https://wa.me/50431910999?text=Hola%20%26%20adi%C3%B3s%0AL%201');
});
```

- [ ] **Step 3: Escribir `tests/search.test.js`**

```js
const test = require('node:test');
const assert = require('node:assert');
const S = require('../js/search.js');

const P = [
  { code: 12, name: 'Consomé de pollo', presentation: '1 lb', category: 'condimentos' },
  { code: 39, name: 'Salsa de chile jalapeño', presentation: '1 galón', category: 'salsas' },
  { code: 43, name: 'Achiote molido', presentation: '25 lb', category: 'sacos' },
];

test('normalize ignora mayúsculas y acentos', () => {
  assert.strictEqual(S.normalize('  Consomé  '), 'consome');
  assert.strictEqual(S.normalize('JALAPEÑO'), 'jalapeno');
});

test('filterProducts por texto, sin acentos', () => {
  assert.deepStrictEqual(S.filterProducts(P, { query: 'CONSOME', category: 'todos' }).map(p => p.code), [12]);
  assert.deepStrictEqual(S.filterProducts(P, { query: 'jalapeno', category: 'todos' }).map(p => p.code), [39]);
});

test('filterProducts por código y por presentación', () => {
  assert.deepStrictEqual(S.filterProducts(P, { query: '43', category: 'todos' }).map(p => p.code), [43]);
  assert.deepStrictEqual(S.filterProducts(P, { query: '25 lb', category: 'todos' }).map(p => p.code), [43]);
});

test('filterProducts por categoría y combinado', () => {
  assert.deepStrictEqual(S.filterProducts(P, { query: '', category: 'salsas' }).map(p => p.code), [39]);
  assert.deepStrictEqual(S.filterProducts(P, { query: 'achiote', category: 'salsas' }), []);
  assert.strictEqual(S.filterProducts(P, { query: '', category: 'todos' }).length, 3);
});
```

- [ ] **Step 4: Ejecutar y ver que fallan**

Run: `npm test`
Expected: FAIL — `Cannot find module '../js/cart.js'`.

- [ ] **Step 5: Implementar `js/cart.js`**

```js
// Lógica pura del carrito: sin DOM ni almacenamiento. Se usa en el navegador (RootsCart) y en Node (tests).
(function (root) {
  var MAX_QTY = 999;

  function money(n) {
    var fixed = (Math.round(n * 100) / 100).toFixed(2);
    var parts = fixed.split('.');
    return 'L ' + parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + parts[1];
  }

  function lineTotal(price, qty) {
    return (Math.round(price * 100) * qty) / 100;
  }

  function clampQty(q) {
    var n = Math.floor(Number(q));
    if (!isFinite(n) || n < 1) return 1;
    return n > MAX_QTY ? MAX_QTY : n;
  }

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

  var api = { MAX_QTY: MAX_QTY, money: money, lineTotal: lineTotal, clampQty: clampQty,
    sanitizeCart: sanitizeCart, cartLines: cartLines, cartTotal: cartTotal, cartCount: cartCount,
    buildMessage: buildMessage, whatsappUrl: whatsappUrl };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RootsCart = api;
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 6: Implementar `js/search.js`**

```js
// Búsqueda y filtrado puros (sin DOM).
(function (root) {
  function normalize(s) {
    return String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  function filterProducts(products, opts) {
    var q = normalize(opts && opts.query);
    var cat = (opts && opts.category) || 'todos';
    return products.filter(function (p) {
      if (cat !== 'todos' && p.category !== cat) return false;
      if (!q) return true;
      var hay = normalize(p.name + ' ' + p.presentation + ' ' + p.code);
      return hay.indexOf(q) !== -1;
    });
  }

  var api = { normalize: normalize, filterProducts: filterProducts };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RootsSearch = api;
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 7: Escribir `js/config.js`**

```js
// Configuración de la tienda. Cambiar aquí y listo.
const SITE_CONFIG = {
  nombreMarca: "Root's",
  whatsapp: '50431910999',        // +504 3191-0999
  moneda: 'L',
  // Menú vivo (Vercel Blob). Se completa en el Task 9. Si falla o está vacío, se usa data/products.js.
  menuUrl: '',
  categorias: [
    { key: 'todos', label: 'Todos' },
    { key: 'condimentos', label: 'Condimentos y especias' },
    { key: 'salsas', label: 'Salsas y vinagres' },
    { key: 'sacos', label: 'Sacos' },
    { key: 'conservas', label: 'Conservas' },
  ],
  contacto: {
    telefono: '+504 3191-0999',
    correo: 'sac@rootshn.com',
    instagram: 'https://www.instagram.com/fooodroots',
    facebook: 'https://www.facebook.com/profile.php?id=61556355161124',
    tiktok: 'https://www.tiktok.com/@foodsroots',
    web: 'https://foodsroots.com',
  },
};
```

- [ ] **Step 8: Ejecutar y ver que pasan**

Run: `npm test`
Expected: PASS (todas las pruebas de `cart.test.js` y `search.test.js`).

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json js/config.js js/cart.js js/search.js tests
git commit -m "Agrega lógica pura de carrito, mensaje de WhatsApp y búsqueda con pruebas"
git push origin main
```

---

### Task 4: Catálogo navegable (header, categorías, buscador, tarjetas, pie)

**Files:**
- Create: `index.html` (reemplaza la página provisional), `css/style.css`, `js/app.js`, `tools/serve.js`

**Interfaces:**
- Consumes: `SITE_CONFIG`, `window.ROOTS_PRODUCTS`, `RootsSearch.filterProducts`, `RootsCart.money`.
- Produces (en `js/app.js`, alcance de módulo): `state = { products, category:'todos', query:'', cart:{} }`; `loadCatalog() -> Promise<Product[]>` (Blob con timeout 3 s → respaldo); `renderGrid()`; contenedores DOM `#app-header`, `#app-cats`, `#app-grid`, `#app-footer`; cada tarjeta es `<article class="card" data-code="N">` con `.card-qty` (input) y `button.add`.

- [ ] **Step 1: `tools/serve.js`** — servidor estático local en el puerto 8099 (copiar el de CRUNCHIES cambiando puerto y mensaje; añadir `.webp: image/webp`, `.svg: image/svg+xml`, `.ico: image/x-icon`).

- [ ] **Step 2: `index.html`** — `lang="es"`, `<meta viewport>`, título "Root's — Catálogo de productos", `<link>` a Google Fonts (Glory 400–800 y Roboto 400/500/700, `display=swap`), `css/style.css`; cuerpo con `<header id="app-header">`, `<nav id="app-cats" aria-label="Categorías">`, `<main><h1 class="sr-only">Catálogo de productos Root's</h1><div id="app-grid" role="list"></div></main>`, `<footer id="app-footer">`, y los scripts en orden: `js/config.js`, `js/cart.js`, `js/search.js`, `data/products.js`, `js/app.js`.

- [ ] **Step 3: `css/style.css`** — variables `:root` con los colores y radios de Global Constraints; `font-size:18px` en `html`; Glory en `h1,h2,h3,.price,.brand`, Roboto en `button,input`; header sticky `#E6F2DE` con sombra cuando `body.scrolled`; píldoras de categoría (alto ≥ 48 px, activa = fondo `#2E7900` texto blanco); rejilla `repeat(auto-fill,minmax(220px,1fr))` con 2 columnas fijas en ≤ 480 px; tarjeta con radio 25 px, imagen en cuadro `aspect-ratio:1/1; object-fit:contain; background:#fff`; botón `Agregar` verde (alto ≥ 48 px); estado `.card.sold-out` con etiqueta "Agotado"; foco visible (`outline:3px solid #3AB54A`); clase `.sr-only`; soporte `@media (prefers-color-scheme: dark)` **no** (el sitio de Root's es claro; se omite).

- [ ] **Step 4: `js/app.js` (parte catálogo)** — implementar:
  - `loadCatalog()`: si `SITE_CONFIG.menuUrl`, `fetch(menuUrl + '?t=' + Date.now())` con `AbortController` a 3 s; si responde `{products:[...]}` con array no vacío, usar ese array; en cualquier fallo usar `window.ROOTS_PRODUCTS`.
  - `renderHeader()`: logo `img/logo.svg` (alt "Root's"), `<input type="search" id="q" placeholder="Buscar producto o código" aria-label="Buscar producto">`, botón de carrito `#cart-btn` (se conecta en Task 5).
  - `renderCats()`: un `<button>` por `SITE_CONFIG.categorias`, `aria-pressed` en el activo.
  - `renderGrid()`: `RootsSearch.filterProducts(state.products, state)`; por cada producto la tarjeta (`<img loading="lazy" width="640" height="640" alt="{name} {presentation}">`, nombre, presentación, `<p class="price">L 75.00 <small>c/u</small></p>`, selector `−`/input/`+`, botón "Agregar"); las 8 primeras sin `loading="lazy"`. Sin resultados: `<p class="empty">No encontramos productos con esa búsqueda.</p>` + botón "Ver todos".
  - Eventos: input de búsqueda (debounce 120 ms), clic en categoría, `scroll` que alterna `body.scrolled`.
  - `renderFooter()`: teléfono, correo, Instagram/Facebook/TikTok, enlace a `SITE_CONFIG.contacto.web`, nota "Precios por unidad, ISV incluido".

- [ ] **Step 5: Verificar en local**

Run: `node tools/serve.js` (en segundo plano) y abrir `http://localhost:8099` con las herramientas de Chrome; capturas a 375 px y 1280 px.
Expected: 56 tarjetas con foto y nombre correctos, 4 categorías filtran (31/11/11/3), buscar "achiote" devuelve 2 (códigos 2 y 43), buscar "jalapeno" devuelve 1, sin desbordamiento horizontal en 375 px. Ajustar CSS hasta que se vea correcto.

- [ ] **Step 6: Commit**

```bash
git add index.html css js/app.js tools/serve.js
git commit -m "Agrega catalogo navegable con categorias, buscador y tarjetas"
git push origin main && vercel --prod --yes
```

---

### Task 5: Carrito y envío por WhatsApp

**Files:**
- Modify: `js/app.js`, `css/style.css`, `index.html` (contenedor `#cart-panel`)

**Interfaces:**
- Consumes: `RootsCart.*` (Task 3), `SITE_CONFIG.whatsapp`, `state.cart`.
- Produces: `saveCart()`/`loadCart()` (clave `roots_cart_v1`, `try/catch`, respaldo en memoria); `setQty(code, qty)`; `renderCartButton()` (FAB con contador y total); `openCart()`/`closeCart()`; `sendOrder()`.

- [ ] **Step 1: Persistencia** — `loadCart()` lee `localStorage['roots_cart_v1']` dentro de `try/catch`, hace `JSON.parse` en `try/catch` y pasa por `RootsCart.sanitizeCart(parsed, state.products)`; `saveCart()` escribe en `try/catch`. Llamar `loadCart()` después de `loadCatalog()`.

- [ ] **Step 2: Tarjetas → carrito** — `Agregar` suma la cantidad del selector al carrito (`setQty(code, clampQty(actual + qty))`) y la tarjeta muestra "En tu pedido: N"; el selector `−/+` y el input (`inputmode="numeric"`) usan `RootsCart.clampQty`.

- [ ] **Step 3: Botón flotante** — `#cart-fab` fijo abajo a la derecha, círculo verde `#2E7900` ≥ 64 px, con ícono de carrito (SVG inline), contador y total (`RootsCart.money`); oculto si el carrito está vacío; `aria-label="Ver mi pedido, N productos, total L X"`.

- [ ] **Step 4: Panel del carrito** — `#cart-panel` (lateral 420 px en escritorio, pantalla completa en ≤ 600 px, `role="dialog" aria-modal="true"`, cierre con botón "Cerrar", tecla Esc y clic fuera; atrapar foco): una fila por línea con miniatura, nombre + presentación, `− N +`, subtotal (`RootsCart.money(l.total)`), botón "Quitar"; total grande; campo `<input id="customer" autocomplete="organization" placeholder="Tu nombre o el de tu negocio">` (obligatorio); botón "Enviar pedido por WhatsApp" (alto ≥ 56 px). Vacío: "Tu pedido está vacío" + botón "Ver productos".

- [ ] **Step 5: `sendOrder()`** — si `customer.trim()` está vacío: mostrar mensaje de error inline bajo el campo (`role="alert"`, texto "Escribe tu nombre o el de tu negocio para enviar el pedido") y enfocar el campo, sin abrir WhatsApp. Si no: `lines = RootsCart.cartLines(state.cart, state.products)`, `msg = RootsCart.buildMessage(lines, RootsCart.cartTotal(lines), customer.trim())`, `window.open(RootsCart.whatsappUrl(SITE_CONFIG.whatsapp, msg), '_blank', 'noopener')`. Guardar el nombre en `localStorage` (`roots_customer`, `try/catch`) para la próxima vez. No vaciar el carrito automáticamente (el cliente puede volver a enviar).

- [ ] **Step 6: Verificar en navegador**

Servir local; a 375 px: agregar 2× Achiote (código 2) y 1× Consomé (12) → FAB muestra 3 y `L 180.00`; recargar → el carrito persiste; abrir el panel, subir a 3 el achiote → total `L 255.00`; intentar enviar sin nombre → error y sin ventana; con nombre "Prueba" → se abre una URL que empieza con `https://wa.me/50431910999?text=` y al decodificarla coincide con el formato del spec §6 (comprobarlo interceptando `window.open` desde la consola/`javascript_tool` en vez de abrir WhatsApp). Un código agotado inyectado a mano en `localStorage` desaparece al recargar.

- [ ] **Step 7: Commit**

```bash
git add index.html css js/app.js
git commit -m "Agrega carrito persistente y envio del pedido por WhatsApp"
git push origin main && vercel --prod --yes
```

---

### Task 6: Animaciones y pulido de accesibilidad

**Files:**
- Modify: `css/style.css`, `js/app.js`

**Interfaces:**
- Consumes: DOM de Tasks 4–5.
- Produces: clases `.reveal` (+ `.in`), `.card` con `--i` (índice para escalonado), `@keyframes fadeInUp, zoomIn, ring`.

- [ ] **Step 1: CSS** — `@keyframes fadeInUp {from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:none}}`, `zoomIn {from{opacity:0;transform:scale(.85)} to{opacity:1;transform:none}}`, `ring {0%{box-shadow:0 0 0 0 rgba(58,181,74,.55)} 100%{box-shadow:0 0 0 18px rgba(58,181,74,0)}}`; `.reveal{opacity:0}` `.reveal.in{animation:fadeInUp .5s ease both}`; `.card.reveal.in{animation:zoomIn .45s ease both; animation-delay:calc(min(var(--i,0)*40ms,400ms))}`; `#cart-fab` con `animation:ring 1.6s infinite` (solo mientras hay productos); hovers `transition:.3s` (tarjeta sube 4 px y sombra; botones oscurecen). Bloque `@media (prefers-reduced-motion: reduce){ .reveal{opacity:1} .reveal.in,.card.reveal.in,#cart-fab{animation:none} *{transition:none!important} }`.

- [ ] **Step 2: JS** — un `IntersectionObserver` (`threshold:.12`, `rootMargin:'0px 0px -40px 0px'`) que añade `.in` una sola vez a cada `.reveal`; asignar `.reveal` a las tarjetas (con `style="--i:N"` relativo a su posición visible, N reiniciado al re-renderizar) y a los títulos/pie; si `IntersectionObserver` no existe, poner `.in` directamente. Al filtrar (`renderGrid`) las tarjetas nuevas también se revelan.

- [ ] **Step 3: Accesibilidad** — revisar: todas las imágenes con `alt`; botones-ícono con `aria-label`; orden de tabulación lógico; el panel del carrito atrapa foco y lo devuelve al FAB al cerrar; contraste de texto blanco sobre `#2E7900` y gris `#5C5C5C` sobre blanco ≥ 4.5:1 (calcularlo: ambos cumplen; si algún estado no, oscurecer).

- [ ] **Step 4: Verificar** — servir local; comprobar que las tarjetas entran con zoom escalonado al cargar/scroll/filtrar, que el FAB pulsa, y que con `prefers-reduced-motion` emulado (DevTools o `javascript_tool` con `matchMedia`) no hay movimiento. Capturas a 375 px y 1280 px.

- [ ] **Step 5: Commit**

```bash
git add css js/app.js
git commit -m "Agrega animaciones de entrada estilo foodsroots y ajustes de accesibilidad"
git push origin main && vercel --prod --yes
```

---

### Task 7: API del admin — autenticación y validación (TDD)

**Files:**
- Create: `lib/auth.js`, `lib/menu.js`, `api/admin-login.js`, `api/admin-save.js`, `tools/make_hash.js`, `tests/auth.test.js`, `tests/menu.test.js`

**Interfaces:**
- Produces:
  - `hashPassword(password:string, saltHex?:string) -> string` (`"<saltHex>:<hashHex>"`, scrypt 64 bytes, salt 16 bytes aleatorios si no se da)
  - `verifyPassword(password:string, stored:string) -> boolean` (nunca lanza; `false` si `stored` es inválido)
  - `validateMenu(menu:any) -> {ok:boolean, error?:string}`: `menu.products` = exactamente 56 productos, códigos enteros 1..56 únicos, `name` string 1..120, `presentation` string 0..30, `category` ∈ `condimentos|salsas|sacos|conservas`, `price` número finito 0..1000000 con ≤ 2 decimales, `soldOut` boolean, `image` que cumple `/^img\/\d+\.webp$/`.
  - `POST /api/admin-login {password}` → 200 `{ok:true}` | 401 `{ok:false}` | 405; `POST /api/admin-save {password, products}` → 200 `{ok:true,url}` | 400 `{error}` | 401 `{error}` | 405 | 500.

- [ ] **Step 1: Escribir `tests/auth.test.js`**

```js
const test = require('node:test');
const assert = require('node:assert');
const { hashPassword, verifyPassword } = require('../lib/auth.js');

test('hashPassword genera salt:hash y verifyPassword acepta la correcta', () => {
  const stored = hashPassword('clave-larga-123');
  assert.match(stored, /^[0-9a-f]{32}:[0-9a-f]{128}$/);
  assert.strictEqual(verifyPassword('clave-larga-123', stored), true);
});

test('verifyPassword rechaza incorrecta y entradas inválidas', () => {
  const stored = hashPassword('clave-larga-123');
  assert.strictEqual(verifyPassword('otra', stored), false);
  assert.strictEqual(verifyPassword('clave-larga-123', ''), false);
  assert.strictEqual(verifyPassword('clave-larga-123', undefined), false);
  assert.strictEqual(verifyPassword(undefined, stored), false);
  assert.strictEqual(verifyPassword('x', 'sin-dos-puntos'), false);
});

test('mismo password con distinto salt da hashes distintos', () => {
  assert.notStrictEqual(hashPassword('a'), hashPassword('a'));
});
```

- [ ] **Step 2: Escribir `tests/menu.test.js`**

```js
const test = require('node:test');
const assert = require('node:assert');
const { validateMenu } = require('../lib/menu.js');

const cat = c => (c <= 31 ? 'condimentos' : c <= 42 ? 'salsas' : c <= 53 ? 'sacos' : 'conservas');
const good = () => ({ products: Array.from({ length: 56 }, (_, i) => ({
  code: i + 1, name: 'Producto ' + (i + 1), presentation: '1 lb', category: cat(i + 1),
  price: 10.5, soldOut: false, image: `img/${i + 1}.webp` })) });

test('menú válido pasa', () => assert.deepStrictEqual(validateMenu(good()), { ok: true }));

test('rechaza forma inválida', () => {
  assert.strictEqual(validateMenu(null).ok, false);
  assert.strictEqual(validateMenu({}).ok, false);
  assert.strictEqual(validateMenu({ products: [] }).ok, false);
});

test('rechaza códigos duplicados o faltantes', () => {
  const m = good(); m.products[5].code = 1;
  assert.strictEqual(validateMenu(m).ok, false);
});

test('rechaza precios inválidos', () => {
  for (const bad of [-1, NaN, Infinity, '10', 10.123, 2e6]) {
    const m = good(); m.products[0].price = bad;
    assert.strictEqual(validateMenu(m).ok, false, 'precio ' + bad);
  }
});

test('rechaza nombre vacío o largo, categoría e imagen inválidas, soldOut no booleano', () => {
  let m = good(); m.products[0].name = '   '; assert.strictEqual(validateMenu(m).ok, false);
  m = good(); m.products[0].name = 'x'.repeat(121); assert.strictEqual(validateMenu(m).ok, false);
  m = good(); m.products[0].category = 'otra'; assert.strictEqual(validateMenu(m).ok, false);
  m = good(); m.products[0].image = 'http://malo.com/x.js'; assert.strictEqual(validateMenu(m).ok, false);
  m = good(); m.products[0].soldOut = 'no'; assert.strictEqual(validateMenu(m).ok, false);
});
```

- [ ] **Step 3: Ver que fallan**

Run: `npm test`
Expected: FAIL — `Cannot find module '../lib/auth.js'`.

- [ ] **Step 4: Implementar `lib/auth.js`**

```js
const crypto = require('crypto');

function hashPassword(password, saltHex) {
  const salt = saltHex ? Buffer.from(saltHex, 'hex') : crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, 64);
  return salt.toString('hex') + ':' + hash.toString('hex');
}

function verifyPassword(password, stored) {
  try {
    if (typeof password !== 'string' || typeof stored !== 'string') return false;
    const [saltHex, hashHex] = stored.split(':');
    if (!saltHex || !hashHex) return false;
    const expected = Buffer.from(hashHex, 'hex');
    const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
    return expected.length > 0 && crypto.timingSafeEqual(actual, expected);
  } catch (e) {
    return false;
  }
}

module.exports = { hashPassword, verifyPassword };
```

- [ ] **Step 5: Implementar `lib/menu.js`**

```js
const CATEGORIES = ['condimentos', 'salsas', 'sacos', 'conservas'];

function validateMenu(menu) {
  if (!menu || !Array.isArray(menu.products)) return { ok: false, error: 'Falta la lista de productos' };
  if (menu.products.length !== 56) return { ok: false, error: 'Deben ser exactamente 56 productos' };
  const seen = new Set();
  for (const p of menu.products) {
    if (!p || !Number.isInteger(p.code) || p.code < 1 || p.code > 56) return { ok: false, error: 'Código inválido' };
    if (seen.has(p.code)) return { ok: false, error: 'Código duplicado: ' + p.code };
    seen.add(p.code);
    const at = ' (código ' + p.code + ')';
    if (typeof p.name !== 'string' || !p.name.trim() || p.name.length > 120) return { ok: false, error: 'Nombre inválido' + at };
    if (typeof p.presentation !== 'string' || p.presentation.length > 30) return { ok: false, error: 'Presentación inválida' + at };
    if (!CATEGORIES.includes(p.category)) return { ok: false, error: 'Categoría inválida' + at };
    if (typeof p.price !== 'number' || !Number.isFinite(p.price) || p.price < 0 || p.price > 1000000 ||
        Math.round(p.price * 100) / 100 !== p.price) return { ok: false, error: 'Precio inválido' + at };
    if (typeof p.soldOut !== 'boolean') return { ok: false, error: 'Estado de agotado inválido' + at };
    if (typeof p.image !== 'string' || !/^img\/\d+\.webp$/.test(p.image)) return { ok: false, error: 'Imagen inválida' + at };
  }
  return { ok: true };
}

module.exports = { validateMenu, CATEGORIES };
```

- [ ] **Step 6: Endpoints `api/admin-login.js` y `api/admin-save.js`**

```js
// api/admin-login.js
const { verifyPassword } = require('../lib/auth.js');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
  const ok = verifyPassword(body && body.password, process.env.ADMIN_PASSWORD_HASH);
  return ok ? res.status(200).json({ ok: true }) : res.status(401).json({ ok: false });
};
```

```js
// api/admin-save.js
const { put } = require('@vercel/blob');
const { verifyPassword } = require('../lib/auth.js');
const { validateMenu } = require('../lib/menu.js');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
  if (!body || typeof body.password !== 'string') return res.status(400).json({ error: 'Solicitud inválida' });
  if (!verifyPassword(body.password, process.env.ADMIN_PASSWORD_HASH)) return res.status(401).json({ error: 'Contraseña incorrecta' });
  const check = validateMenu(body);
  if (!check.ok) return res.status(400).json({ error: check.error });
  try {
    const blob = await put('menu.json', JSON.stringify({ products: body.products }, null, 2), {
      access: 'public', contentType: 'application/json', addRandomSuffix: false,
      allowOverwrite: true, cacheControlMaxAge: 0,
    });
    return res.status(200).json({ ok: true, url: blob.url });
  } catch (err) {
    return res.status(500).json({ error: 'No se pudo guardar: ' + err.message });
  }
};
```

- [ ] **Step 7: `tools/make_hash.js`**

```js
// Uso: node tools/make_hash.js "<contraseña>"  ->  imprime salt:hash para ADMIN_PASSWORD_HASH
const { hashPassword } = require('../lib/auth.js');
if (!process.argv[2]) { console.error('Falta la contraseña'); process.exit(1); }
console.log(hashPassword(process.argv[2]));
```

- [ ] **Step 8: Ver que pasan**

Run: `npm test`
Expected: PASS (auth, menu, cart, search).

- [ ] **Step 9: Commit**

```bash
git add lib api tools/make_hash.js tests
git commit -m "Agrega API del admin con scrypt y validacion del menu"
git push origin main
```

---

### Task 8: Panel admin (UI)

**Files:**
- Create: `admin.html`, `js/admin.js`
- Modify: `css/style.css` (estilos `.admin-*`)

**Interfaces:**
- Consumes: `POST /api/admin-login`, `POST /api/admin-save`, `SITE_CONFIG.menuUrl`, `window.ROOTS_PRODUCTS`.
- Produces: pantalla de acceso, tabla editable de 56 filas, botón "Guardar cambios".

- [ ] **Step 1: `admin.html`** — `<meta name="robots" content="noindex">`, mismos fuentes/estilos; carga `js/config.js`, `data/products.js`, `js/admin.js`; contiene `#login` (input contraseña + botón "Entrar") y `#panel` (oculto).

- [ ] **Step 2: `js/admin.js`** — al entrar: `fetch('/api/admin-login', POST {password})`; si 200, guardar la contraseña solo en memoria (variable del módulo, nunca en `localStorage`), cargar el menú vivo (`menuUrl` con respaldo a `ROOTS_PRODUCTS`) y pintar una tabla con columnas Código · Foto (miniatura 48 px) · Nombre (input texto) · Presentación (texto, solo lectura) · Precio (input numérico `step="0.01" min="0"`) · Agotado (checkbox 48 px). Filtro rápido por texto. "Guardar cambios": convertir precio con `Number(value)`, `POST /api/admin-save {password, products}`; mostrar "Guardado ✓" o el `error` devuelto; deshabilitar el botón mientras se envía; 401 → volver a la pantalla de acceso.

- [ ] **Step 3: Verificar contra el servidor local**

`tools/serve.js` es estático y no ejecuta `api/`, así que la verificación del guardado se hace en el Task 9 con `vercel dev` o ya desplegado. Aquí: comprobar que la pantalla de acceso y la tabla se pintan (simular login exitoso interceptando `fetch` con `javascript_tool`) y que editar un precio/nombre actualiza el objeto que se enviaría.

- [ ] **Step 4: Commit**

```bash
git add admin.html js/admin.js css/style.css
git commit -m "Agrega panel admin para editar precios y agotados"
git push origin main
```

---

### Task 9: Blob, contraseña, despliegue y prueba de punta a punta

**Files:**
- Create: `tools/seed-blob.js`
- Modify: `js/config.js` (`menuUrl`)

- [ ] **Step 1: Crear el Blob store del proyecto** — ejecutar `vercel blob --help` para confirmar el subcomando de creación de store (o usar la herramienta MCP de Vercel `create_storage_stores_blob`), crear el store `roots-menu` público y **conectarlo al proyecto `roots-catalogo`** para que `BLOB_READ_WRITE_TOKEN` exista en Vercel. Luego `vercel env pull .env.local --yes` para tener el token local (`.env*` está ignorado).

- [ ] **Step 2: `tools/seed-blob.js`**

```js
// Sube data/products.js como menu.json al Blob (menú inicial). Requiere BLOB_READ_WRITE_TOKEN en el entorno.
const fs = require('fs');
const { put } = require('@vercel/blob');

const code = fs.readFileSync(__dirname + '/../data/products.js', 'utf8');
const products = JSON.parse(code.slice(code.indexOf('['), code.lastIndexOf(']') + 1));

(async () => {
  const blob = await put('menu.json', JSON.stringify({ products }, null, 2), {
    access: 'public', contentType: 'application/json', addRandomSuffix: false,
    allowOverwrite: true, cacheControlMaxAge: 0,
  });
  console.log('Subido:', blob.url);
})();
```

Run: `node --env-file=.env.local tools/seed-blob.js`
Expected: `Subido: https://<id>.public.blob.vercel-storage.com/menu.json`. Pegar esa URL en `SITE_CONFIG.menuUrl` (`js/config.js`).

- [ ] **Step 3: Contraseña del admin** — generar una contraseña larga aleatoria (≥ 16 caracteres) con `node -e "console.log(require('crypto').randomBytes(12).toString('base64url'))"`; calcular `node tools/make_hash.js "<contraseña>"`; guardarla en Vercel: `printf '%s' "<salt:hash>" | vercel env add ADMIN_PASSWORD_HASH production` (y `preview`). Entregar la contraseña **solo en el chat**.

- [ ] **Step 4: Desplegar y probar la API**

```bash
git add tools/seed-blob.js js/config.js
git commit -m "Conecta el catalogo al menu vivo en Vercel Blob"
git push origin main && vercel --prod --yes
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://roots-catalogo.vercel.app/api/admin-login -H "content-type: application/json" -d '{"password":"incorrecta"}'
```
Expected: `401`. Con la contraseña correcta: `200`. `admin-save` con la contraseña correcta y un menú inválido (por ejemplo `{"password":"<ok>","products":[]}`): `400`. `GET https://roots-catalogo.vercel.app/api/admin-login`: `405`.

- [ ] **Step 5: Prueba de punta a punta del admin** — en producción: entrar a `/admin.html`, cambiar el precio del producto 12 (Consomé de pollo) de 30 a 31 y guardar; recargar el catálogo público (sin republicar) y confirmar `L 31.00`; **restaurar el precio a 30** y guardar de nuevo. Marcar un producto como agotado, verificar que aparece "Agotado" y no se puede agregar, y desmarcarlo.

---

### Task 10: Verificación final y cierre

**Files:**
- Create: `README.md` (reemplaza el provisional)

- [ ] **Step 1: `npm test`** — todo en verde.

- [ ] **Step 2: Recorrido completo en producción** (https://roots-catalogo.vercel.app, 375 px y 1280 px, con las herramientas de Chrome): las 56 fotos cargan y corresponden al nombre (muestreo de una por categoría más los códigos 1, 32, 43, 54); filtrar por cada categoría; buscar; armar un pedido de 3 productos; comprobar el mensaje decodificado (interceptando `window.open`) contra el formato del spec §6; recargar y confirmar persistencia; sin errores en consola (`read_console_messages`); sin desbordamiento horizontal; medir el peso de la página inicial (`read_network_requests`) y confirmar que las imágenes son WebP.

- [ ] **Step 3: `README.md`** — qué es, cómo correr (`npm install`, `npm test`, `node tools/serve.js`), cómo regenerar datos e imágenes (`python tools/build_data.py`, `python tools/optimize_images.py`), variables de entorno (`BLOB_READ_WRITE_TOKEN`, `ADMIN_PASSWORD_HASH`), cómo cambiar la contraseña (`node tools/make_hash.js` + `vercel env`), y dónde está el spec y el plan.

- [ ] **Step 4: Cierre** — commit + push + `vercel --prod --yes`; actualizar la memoria del proyecto (`project_roots_catalogo.md`: URL viva, Blob store, estructura, cómo cambiar precios, estado final) y guardar en engram; entregar al usuario la URL, la contraseña del admin y un resumen honesto de lo verificado y lo no verificado.

```bash
git add README.md
git commit -m "Agrega README del proyecto"
git push origin main && vercel --prod --yes
```
