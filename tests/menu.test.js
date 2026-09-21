const test = require('node:test');
const assert = require('node:assert');
const { validateMenu, VALID_CODES } = require('../lib/menu.js');

const cat = c => (c <= 31 ? 'condimentos' : c <= 42 ? 'salsas' : c <= 53 ? 'sacos' : 'conservas');
const good = () => ({ products: VALID_CODES.map(code => ({
  code, name: 'Producto ' + code, presentation: '1 lb', category: cat(code),
  price: 10.5, soldOut: false, image: `img/${code}.webp` })) });

test('los códigos válidos son 1..56 sin el 10 (55 productos)', () => {
  assert.strictEqual(VALID_CODES.length, 55);
  assert.strictEqual(VALID_CODES.includes(10), false);
  assert.strictEqual(VALID_CODES[0], 1);
  assert.strictEqual(VALID_CODES[VALID_CODES.length - 1], 56);
});

test('menú válido pasa', () => assert.deepStrictEqual(validateMenu(good()), { ok: true }));

test('rechaza forma inválida', () => {
  assert.strictEqual(validateMenu(null).ok, false);
  assert.strictEqual(validateMenu({}).ok, false);
  assert.strictEqual(validateMenu({ products: [] }).ok, false);
  assert.strictEqual(validateMenu({ products: 'x' }).ok, false);
});

test('rechaza códigos duplicados, faltantes o fuera del catálogo', () => {
  let m = good(); m.products[5].code = 1;
  assert.strictEqual(validateMenu(m).ok, false);
  m = good(); m.products[9].code = 10; m.products[9].image = 'img/10.webp';
  assert.strictEqual(validateMenu(m).ok, false, 'el código 10 no existe');
  m = good(); m.products[0].code = 57; m.products[0].image = 'img/57.webp';
  assert.strictEqual(validateMenu(m).ok, false);
  m = good(); m.products.pop();
  assert.strictEqual(validateMenu(m).ok, false);
});

test('rechaza precios inválidos', () => {
  for (const bad of [-1, NaN, Infinity, '10', 10.123, 2e6, null]) {
    const m = good(); m.products[0].price = bad;
    assert.strictEqual(validateMenu(m).ok, false, 'precio ' + bad);
  }
});

test('acepta precio 0 y decimales de 2 posiciones', () => {
  const m = good(); m.products[0].price = 0; m.products[1].price = 118.25;
  assert.deepStrictEqual(validateMenu(m), { ok: true });
});

test('rechaza nombre vacío o largo, categoría e imagen inválidas, soldOut no booleano', () => {
  let m = good(); m.products[0].name = '   '; assert.strictEqual(validateMenu(m).ok, false);
  m = good(); m.products[0].name = 'x'.repeat(121); assert.strictEqual(validateMenu(m).ok, false);
  m = good(); m.products[0].category = 'otra'; assert.strictEqual(validateMenu(m).ok, false);
  m = good(); m.products[0].image = 'http://malo.com/x.js'; assert.strictEqual(validateMenu(m).ok, false);
  m = good(); m.products[0].soldOut = 'no'; assert.strictEqual(validateMenu(m).ok, false);
  m = good(); m.products[0].presentation = 'x'.repeat(31); assert.strictEqual(validateMenu(m).ok, false);
});
