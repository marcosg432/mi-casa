'use strict';

var { config } = require('../config');

async function verifyTurnstile(token, remoteip) {
  if (!config.turnstileSecretKey) {
    if (config.isProduction) {
      return { ok: false, error: 'Turnstile não configurado.' };
    }
    return { ok: true, skipped: true };
  }
  if (!token) {
    return { ok: false, error: 'Verificação de segurança ausente.' };
  }

  var body = new URLSearchParams();
  body.set('secret', config.turnstileSecretKey);
  body.set('response', token);
  if (remoteip) body.set('remoteip', remoteip);

  var res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });

  var data = await res.json();
  if (!data.success) {
    return { ok: false, error: 'Verificação de segurança falhou.' };
  }
  return { ok: true };
}

module.exports = { verifyTurnstile: verifyTurnstile };
