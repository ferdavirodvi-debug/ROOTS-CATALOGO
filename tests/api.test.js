const test = require('node:test');
const assert = require('node:assert');
const { hashPassword } = require('../lib/auth.js');
const { VALID_CODES } = require('../lib/menu.js');

process.env.ADMIN_PASSWORD_HASH = hashPassword('clave-de-prueba-123');
const login = require('../api/admin-login.js');
const save = require('../api/admin-save.js');

function call(handler, method, body) {
  return new Promise((resolve) => {
    const res = { code: 0, status(c) { this.code = c; return this; }, json(b) { resolve({ code: this.code, body: b }); } };
    handler({ method, body }, res);
  });
}

const cat = c => (c <= 31 ? 'condimentos' : c <= 42 ? 'salsas' : c <= 53 ? 'sacos' : 'conservas');
const products = () => VALID_CODES.map(code => ({ code, name: 'P' + code, presentation: '1 lb', category: cat(code), price: 1, soldOut: false, image: `img/${code}.webp` }));

test('login: 405 si no es POST', async () => assert.strictEqual((await call(login, 'GET')).code, 405));
test('login: 401 con contraseña incorrecta o ausente', async () => {
  assert.strictEqual((await call(login, 'POST', { password: 'mala' })).code, 401);
  assert.strictEqual((await call(login, 'POST', {})).code, 401);
  assert.strictEqual((await call(login, 'POST', 'no-json')).code, 401);
});
test('login: 200 con la contraseña correcta (cuerpo objeto o texto JSON)', async () => {
  assert.strictEqual((await call(login, 'POST', { password: 'clave-de-prueba-123' })).code, 200);
  assert.strictEqual((await call(login, 'POST', JSON.stringify({ password: 'clave-de-prueba-123' }))).code, 200);
});
test('login: 401 si el servidor no tiene ADMIN_PASSWORD_HASH', async () => {
  const saved = process.env.ADMIN_PASSWORD_HASH; delete process.env.ADMIN_PASSWORD_HASH;
  assert.strictEqual((await call(login, 'POST', { password: 'clave-de-prueba-123' })).code, 401);
  process.env.ADMIN_PASSWORD_HASH = saved;
});

test('save: 405 si no es POST', async () => assert.strictEqual((await call(save, 'GET')).code, 405));
test('save: 400 sin contraseña, 401 con contraseña incorrecta', async () => {
  assert.strictEqual((await call(save, 'POST', { products: products() })).code, 400);
  assert.strictEqual((await call(save, 'POST', { password: 'mala', products: products() })).code, 401);
});
test('save: 400 con menú inválido aunque la contraseña sea correcta', async () => {
  const r = await call(save, 'POST', { password: 'clave-de-prueba-123', products: [] });
  assert.strictEqual(r.code, 400);
  const bad = products(); bad[0].price = -5;
  assert.strictEqual((await call(save, 'POST', { password: 'clave-de-prueba-123', products: bad })).code, 400);
});
