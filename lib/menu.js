const CATEGORIES = ['condimentos', 'salsas', 'sacos', 'conservas'];
// Códigos = número de foto. Van del 1 al 56 sin el 10 (chile hojuela 300 g no está en la lista vigente).
const VALID_CODES = Array.from({ length: 56 }, (_, i) => i + 1).filter(c => c !== 10);

function validateMenu(menu) {
  if (!menu || !Array.isArray(menu.products)) return { ok: false, error: 'Falta la lista de productos' };
  if (menu.products.length !== VALID_CODES.length) return { ok: false, error: 'Deben ser exactamente ' + VALID_CODES.length + ' productos' };
  const seen = new Set();
  for (const p of menu.products) {
    if (!p || !Number.isInteger(p.code) || !VALID_CODES.includes(p.code)) return { ok: false, error: 'Código inválido' };
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

module.exports = { validateMenu, VALID_CODES, CATEGORIES };
