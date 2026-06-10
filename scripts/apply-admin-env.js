#!/usr/bin/env node
'use strict';

/**
 * Garante ADMIN_USERNAME e ADMIN_PASSWORD_HASH no .env da VPS.
 * Uso: node scripts/apply-admin-env.js
 */

var fs = require('fs');
var path = require('path');

var ENV_PATH = path.join(__dirname, '..', '.env');
var USER = 'micasasucasaben@gmail.com';
var HASH = '$2a$12$MJBPfqhhw7o5DRWe6s8.c.Hq.iG5f7KxrCB4aGBflh.lbmRsKHYjm';

var lines = [];
if (fs.existsSync(ENV_PATH)) {
  lines = fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/);
}

function setVar(name, value) {
  var key = name + '=';
  var found = false;
  lines = lines.map(function (line) {
    if (line.startsWith(key)) {
      found = true;
      return key + value;
    }
    return line;
  });
  if (!found) lines.push(key + value);
}

setVar('ADMIN_USERNAME', USER);
setVar('ADMIN_PASSWORD_HASH', '"' + HASH + '"');
setVar('DISABLE_PANEL_AUTH', '0');
setVar('NODE_ENV', 'development');
setVar('PORT', '3014');

var out = lines.join('\n');
if (!out.endsWith('\n')) out += '\n';
fs.writeFileSync(ENV_PATH, out, 'utf8');

console.log('OK — .env atualizado:');
console.log('  ADMIN_USERNAME=' + USER);
console.log('  DISABLE_PANEL_AUTH=0');
console.log('  PORT=3014');
