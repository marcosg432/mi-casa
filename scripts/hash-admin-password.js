#!/usr/bin/env node
'use strict';

var bcrypt = require('bcryptjs');
var readline = require('readline');

var rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question('Senha do administrador: ', function (password) {
  rl.close();
  if (!password || password.length < 8) {
    console.error('Use pelo menos 8 caracteres.');
    process.exit(1);
  }
  var hash = bcrypt.hashSync(password, 12);
  console.log('\nCole no .env:\n');
  console.log('ADMIN_PASSWORD_HASH=' + hash);
});
