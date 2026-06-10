'use strict';

require('dotenv').config();
var bcrypt = require('bcryptjs');
var { config } = require('../server/config');

var email = process.argv[2] || 'micasasucasaben@gmail.com';
var senha = process.argv[3] || '';

console.log('ADMIN_USERNAME configurado:', config.adminUsername || '(vazio)');
console.log('ADMIN_PASSWORD_HASH presente:', config.adminPasswordHash ? 'sim (' + config.adminPasswordHash.length + ' chars)' : 'NÃO');
console.log('DISABLE_PANEL_AUTH:', config.disablePanelAuth);
console.log('NODE_ENV:', config.nodeEnv);

if (!senha) {
  console.log('\nUso: node scripts/verify-admin-login.js email senha');
  process.exit(0);
}

var userOk = String(email).trim().toLowerCase() === String(config.adminUsername || '').trim().toLowerCase();
var passOk = config.adminPasswordHash && bcrypt.compareSync(senha, config.adminPasswordHash);

console.log('\nE-mail confere:', userOk ? 'SIM' : 'NÃO');
console.log('Senha confere:', passOk ? 'SIM' : 'NÃO');
process.exit(userOk && passOk ? 0 : 1);
