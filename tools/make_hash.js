// Uso: node tools/make_hash.js "<contraseña>"  ->  imprime "salt:hash" para la variable ADMIN_PASSWORD_HASH
const { hashPassword } = require('../lib/auth.js');
if (!process.argv[2]) { console.error('Falta la contraseña'); process.exit(1); }
console.log(hashPassword(process.argv[2]));
