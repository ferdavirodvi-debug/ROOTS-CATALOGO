// Sube data/products.js como menu.json al Blob (menú inicial o para restaurar).
// Uso: node --env-file=.env.local tools/seed-blob.js   (requiere BLOB_READ_WRITE_TOKEN)
const fs = require('fs');
const { put } = require('@vercel/blob');

const code = fs.readFileSync(__dirname + '/../data/products.js', 'utf8');
const products = JSON.parse(code.slice(code.indexOf('['), code.lastIndexOf(']') + 1));

(async () => {
  const blob = await put('menu.json', JSON.stringify({ products }, null, 2), {
    access: 'public', contentType: 'application/json', addRandomSuffix: false,
    allowOverwrite: true, cacheControlMaxAge: 0,
  });
  console.log('Subido:', blob.url, '(' + products.length + ' productos)');
})().catch((e) => { console.error('Error:', e.message); process.exit(1); });
