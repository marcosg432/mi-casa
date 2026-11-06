'use strict';

var fs = require('fs');
var path = require('path');
var { config } = require('./config');

var FILE = path.join(__dirname, '..', 'data', 'mail-settings.json');

function readFile() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch (e) {
    return {};
  }
}

function emailOk(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function getMailSettings() {
  var saved = readFile();
  return {
    smtpHost: saved.smtpHost || config.smtpHost || 'smtp.gmail.com',
    smtpPort: Number(saved.smtpPort || config.smtpPort) || 587,
    smtpUser: String(saved.smtpUser || config.smtpUser || '').trim(),
    smtpPass: String(saved.smtpPass || config.smtpPass || ''),
    notifyEmail: String(saved.notifyEmail || config.notifyEmail || '').trim(),
    googleEmail: String(saved.googleEmail || '').trim(),
    googleRefreshToken: String(saved.googleRefreshToken || '')
  };
}

function publicMailSettings() {
  var saved = readFile();
  var smtpUser = String(saved.smtpUser || config.smtpUser || '').trim();
  var notifyEmail = String(saved.notifyEmail || '').trim();
  return {
    smtpUser: smtpUser,
    notifyEmail: notifyEmail,
    hasPassword: !!(saved.smtpPass || config.smtpPass),
    googleEmail: String(saved.googleEmail || '').trim(),
    googleConnected: !!(saved.googleRefreshToken && saved.googleEmail),
    oauthReady: !!(config.googleClientId && config.googleClientSecret)
  };
}

function writeFile(data) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(data), { encoding: 'utf8', mode: 0o600 });
}

function saveMailSettings(input) {
  var current = readFile();
  var notifyEmail = String((input && input.notifyEmail) || '').trim();
  if (!emailOk(notifyEmail)) {
    var bad = new Error('Informe o e-mail que recebe.');
    bad.status = 400;
    throw bad;
  }
  var next = Object.assign({}, current, { notifyEmail: notifyEmail });
  var smtpUser = String((input && input.smtpUser) || '').trim();
  var smtpPass = String((input && input.smtpPass) || '');
  if (emailOk(smtpUser)) next.smtpUser = smtpUser;
  if (smtpPass.trim()) next.smtpPass = smtpPass.trim();
  writeFile(next);
  return publicMailSettings();
}

function saveGoogleConnection(email, refreshToken) {
  var current = readFile();
  var conta = String(email || '').trim();
  if (!emailOk(conta)) {
    var bad = new Error('O Google não informou o e-mail da conta.');
    bad.status = 400;
    throw bad;
  }
  var token = String(refreshToken || '');
  if (!token) token = current.googleEmail === conta ? String(current.googleRefreshToken || '') : '';
  if (!token) {
    var missing = new Error('O Google não entregou o acesso. Conecte de novo e aceite o envio.');
    missing.status = 400;
    throw missing;
  }
  current.googleEmail = conta;
  current.googleRefreshToken = token;
  current.smtpUser = conta;
  writeFile(current);
  return publicMailSettings();
}

module.exports = {
  getMailSettings: getMailSettings,
  publicMailSettings: publicMailSettings,
  saveMailSettings: saveMailSettings,
  saveGoogleConnection: saveGoogleConnection
};
