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
  assert.strictEqual(verifyPassword('x', 'zz:zz'), false);
});

test('mismo password con distinto salt da hashes distintos', () => {
  assert.notStrictEqual(hashPassword('a'), hashPassword('a'));
});
