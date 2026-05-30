'use strict';

var { config } = require('../config');
var { verifySessionToken, clearSessionCookie } = require('../auth');

function readToken(req) {
  return req.cookies && req.cookies[config.sessionCookieName];
}

function requireAuth(req, res, next) {
  var token = readToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Não autenticado.' });
  }
  try {
    req.adminUser = verifySessionToken(token);
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Sessão expirada ou inválida.' });
  }
}

function requireAuthPage(req, res, next) {
  var token = readToken(req);
  if (!token) {
    return res.redirect(302, '/login.html?next=' + encodeURIComponent(req.originalUrl || '/painel.html'));
  }
  try {
    verifySessionToken(token);
    next();
  } catch (e) {
    clearSessionCookie(res);
    return res.redirect(302, '/login.html?next=' + encodeURIComponent(req.originalUrl || '/painel.html'));
  }
}

module.exports = { requireAuth: requireAuth, requireAuthPage: requireAuthPage };
