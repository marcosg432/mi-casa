'use strict';

var express = require('express');
var { config } = require('../config');
var { signSession, verifyAdminCredentials, cookieOptions, clearSessionCookie } = require('../auth');
var { requireAuth } = require('../middleware/require-auth');
var { loginLimiter } = require('../middleware/login-rate-limit');

var router = express.Router();

router.post('/login', loginLimiter, express.json(), async function (req, res) {
  try {
    var username = req.body && req.body.username;
    var password = req.body && req.body.password;
    var ok = await verifyAdminCredentials(username, password);
    if (!ok) {
      return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
    }
    var token = signSession(config.adminUsername);
    res.cookie(config.sessionCookieName, token, cookieOptions());
    res.json({ ok: true, user: config.adminUsername });
  } catch (e) {
    console.error('[auth/login]', e);
    res.status(500).json({ error: 'Erro ao iniciar sessão.' });
  }
});

router.post('/logout', function (req, res) {
  clearSessionCookie(res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, function (req, res) {
  res.json({ ok: true, user: req.adminUser.sub });
});

module.exports = router;
