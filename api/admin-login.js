const { verifyPassword } = require('../lib/auth.js');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
  const ok = verifyPassword(body && body.password, process.env.ADMIN_PASSWORD_HASH);
  return ok ? res.status(200).json({ ok: true }) : res.status(401).json({ ok: false });
};
