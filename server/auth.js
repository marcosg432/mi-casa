'use strict';

var bcrypt = require('bcryptjs');
var jwt = require('jsonwebtoken');
var { config } = require('./config');

function signSession(username) {
  return jwt.sign(
    { sub: username, role: 'admin' },
    config.jwtSecret,
    { expiresIn: Math.floor(config.sessionMaxAgeMs / 1000) + 's' }
  );
}

function verifySessionToken(token) {
  return jwt.verify(token, config.jwtSecret);
}

async function verifyAdminCredentials(username, password) {
  var user = String(username || '').trim().toLowerCase();
  var pass = String(password || '');
  var expected = String(config.adminUsername || '').trim().toLowerCase();
  if (!user || !pass) return false;
  if (user !== expected) return false;
  if (!config.adminPasswordHash) return false;
  return bcrypt.compare(pass, config.adminPasswordHash);
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'strict',
    maxAge: config.sessionMaxAgeMs,
    path: '/'
  };
}

function clearSessionCookie(res) {
  res.clearCookie(config.sessionCookieName, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'strict',
    path: '/'
  });
}

module.exports = {
  signSession: signSession,
  verifySessionToken: verifySessionToken,
  verifyAdminCredentials: verifyAdminCredentials,
  cookieOptions: cookieOptions,
  clearSessionCookie: clearSessionCookie
};
