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
