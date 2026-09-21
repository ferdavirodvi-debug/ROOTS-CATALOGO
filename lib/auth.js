const crypto = require('crypto');

// Formato guardado: "<salt hex>:<hash hex>" (scrypt, 64 bytes).
function hashPassword(password, saltHex) {
  const salt = saltHex ? Buffer.from(saltHex, 'hex') : crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, 64);
  return salt.toString('hex') + ':' + hash.toString('hex');
}

// Nunca lanza: cualquier entrada inválida devuelve false. Comparación en tiempo constante.
function verifyPassword(password, stored) {
  try {
    if (typeof password !== 'string' || typeof stored !== 'string') return false;
    const parts = stored.split(':');
    if (parts.length !== 2 || !/^[0-9a-f]+$/i.test(parts[0]) || !/^[0-9a-f]+$/i.test(parts[1])) return false;
    const expected = Buffer.from(parts[1], 'hex');
    if (!expected.length) return false;
    const actual = crypto.scryptSync(password, Buffer.from(parts[0], 'hex'), expected.length);
    return crypto.timingSafeEqual(actual, expected);
  } catch (e) {
    return false;
  }
}

module.exports = { hashPassword, verifyPassword };
