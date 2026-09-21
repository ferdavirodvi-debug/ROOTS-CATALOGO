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
