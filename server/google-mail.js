'use strict';

var crypto = require('crypto');
var https = require('https');
var { config } = require('./config');
var { saveGoogleConnection } = require('./mail-settings');

var STATE_COOKIE = 'mcsc_google_oauth';

function redirectUri(req) {
  var proto = req.get('x-forwarded-proto') || req.protocol;
  var host = req.get('x-forwarded-host') || req.get('host');
  return proto + '://' + host + '/api/admin/email/google/callback';
}

function requestHttps(method, url, headers, body) {
  return new Promise(function (resolve, reject) {
    var target = new URL(url);
    var req = https.request(
      {
        hostname: target.hostname,
        path: target.pathname + target.search,
        method: method,
        headers: headers
      },
      function (res) {
        var chunks = [];
        res.on('data', function (chunk) {
          chunks.push(chunk);
        });
        res.on('end', function () {
          var text = Buffer.concat(chunks).toString('utf8');
          var json = {};
          try {
            json = JSON.parse(text);
          } catch (e) {
            json = { error: text };
          }
          resolve({ status: res.statusCode, json: json });
        });
      }
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function postForm(url, params) {
  var body = new URLSearchParams(params).toString();
  return requestHttps(
    'POST',
    url,
    {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(body)
    },
    body
  );
}

function sameValue(a, b) {
  var left = Buffer.from(String(a || ''));
  var right = Buffer.from(String(b || ''));
  if (left.length !== right.length || left.length === 0) return false;
  return crypto.timingSafeEqual(left, right);
}

function pageBack(res, flag) {
  var safe = ['ok', 'negado', 'falha'].indexOf(flag) >= 0 ? flag : 'falha';
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.send(
    '<!doctype html><meta charset="utf-8"><title>Gmail</title>' +
      '<p>Voltando ao painel…</p>' +
      '<script>location.replace("/painel.html?tab=email&google=' +
      safe +
      '")</script>'
  );
}

function startGoogleConnect(req, res) {
  if (!config.googleClientId || !config.googleClientSecret) {
    res.redirect('/painel.html?tab=email&google=falha');
    return;
  }
  var state = crypto.randomBytes(24).toString('hex');
  res.cookie(STATE_COOKIE, state, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000,
    path: '/'
  });
  var params = new URLSearchParams({
    client_id: config.googleClientId,
    redirect_uri: redirectUri(req),
    response_type: 'code',
    scope: 'openid email https://www.googleapis.com/auth/gmail.send',
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state: state
  });
  res.redirect('https://accounts.google.com/o/oauth2/v2/auth?' + params.toString());
}

async function handleGoogleCallback(req, res) {
  var savedState = req.cookies && req.cookies[STATE_COOKIE];
  res.clearCookie(STATE_COOKIE, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'lax',
    path: '/'
  });
  if (req.query && req.query.error) {
    pageBack(res, 'negado');
    return;
  }
  if (!sameValue(savedState, req.query && req.query.state) || !req.query.code) {
    pageBack(res, 'falha');
    return;
  }
  try {
    var tokenRes = await postForm('https://oauth2.googleapis.com/token', {
      code: String(req.query.code),
      client_id: config.googleClientId,
      client_secret: config.googleClientSecret,
      redirect_uri: redirectUri(req),
      grant_type: 'authorization_code'
    });
    if (tokenRes.status >= 400 || !tokenRes.json.access_token) {
      console.error('[email/google] troca do código falhou', tokenRes.json.error || tokenRes.status);
      pageBack(res, 'falha');
      return;
    }
    var profileRes = await requestHttps(
      'GET',
      'https://www.googleapis.com/oauth2/v2/userinfo',
      { Authorization: 'Bearer ' + tokenRes.json.access_token },
      null
    );
    var email = profileRes.json && profileRes.json.email;
    saveGoogleConnection(email, tokenRes.json.refresh_token || '');
    pageBack(res, 'ok');
  } catch (e) {
    console.error('[email/google]', e.message || e);
    pageBack(res, 'falha');
  }
}

async function obterAccessToken(refreshToken) {
  var tokenRes = await postForm('https://oauth2.googleapis.com/token', {
    client_id: config.googleClientId,
    client_secret: config.googleClientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token'
  });
  if (tokenRes.status >= 400 || !tokenRes.json.access_token) {
    var err = new Error('A conexão com o Gmail expirou. Conecte a conta de novo.');
    err.status = 400;
    throw err;
  }
  return tokenRes.json.access_token;
}

function mensagemCrua(from, to, subject, text, html) {
  var boundary = 'mcsc_' + crypto.randomBytes(8).toString('hex');
  var lines = [
    'From: ' + from,
    'To: ' + to,
    'Subject: =?UTF-8?B?' + Buffer.from(subject, 'utf8').toString('base64') + '?=',
    'MIME-Version: 1.0',
    'Content-Type: multipart/alternative; boundary="' + boundary + '"',
    '',
    '--' + boundary,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    text,
    '',
    '--' + boundary,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    html,
    '',
    '--' + boundary + '--',
    ''
  ];
  return Buffer.from(lines.join('\r\n'))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function enviarPeloGmail(accessToken, mail) {
  var raw = mensagemCrua(mail.from, mail.to, mail.subject, mail.text, mail.html);
  var body = JSON.stringify({ raw: raw });
  var sent = await requestHttps(
    'POST',
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    {
      Authorization: 'Bearer ' + accessToken,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    },
    body
  );
  if (sent.status >= 400) {
    var reason = (sent.json.error && sent.json.error.message) || '';
    console.error('[email/gmail]', sent.status, reason);
    var message = 'O Gmail não enviou o aviso.';
    if (/accessNotConfigured|Gmail API has not been used|disabled/i.test(reason)) {
      message = 'Ative a Gmail API no projeto do Google e conecte a conta de novo.';
    } else if (/insufficient/i.test(reason)) {
      message = 'Conecte o Gmail de novo e aceite o envio de e-mail.';
    }
    var err = new Error(message);
    err.status = 400;
    throw err;
  }
  return sent.json;
}

module.exports = {
  startGoogleConnect: startGoogleConnect,
  handleGoogleCallback: handleGoogleCallback,
  obterAccessToken: obterAccessToken,
  enviarPeloGmail: enviarPeloGmail
};
