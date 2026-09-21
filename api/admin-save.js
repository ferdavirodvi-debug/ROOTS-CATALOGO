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
