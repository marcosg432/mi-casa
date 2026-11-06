'use strict';

var nodemailer = require('nodemailer');
var { config } = require('./config');
var { getMailSettings } = require('./mail-settings');
var { obterAccessToken, enviarPeloGmail } = require('./google-mail');

async function abrirEnvio() {
  var settings = getMailSettings();
  if (!settings.notifyEmail) return null;
  if (settings.googleRefreshToken && settings.googleEmail && config.googleClientId && config.googleClientSecret) {
    var accessToken = await obterAccessToken(settings.googleRefreshToken);
    return {
      mode: 'gmail',
      settings: settings,
      accessToken: accessToken,
      from: settings.googleEmail
    };
  }
  if (!settings.smtpUser || !settings.smtpPass) return null;
  return {
    mode: 'smtp',
    settings: settings,
    from: settings.smtpUser,
    transport: nodemailer.createTransport({
      host: settings.smtpHost,
      port: settings.smtpPort,
      secure: settings.smtpPort === 465,
      auth: {
        user: settings.smtpUser,
        pass: settings.smtpPass
      }
    })
  };
}

async function entregar(aberto, subject, text, html) {
  if (aberto.mode === 'gmail') {
    await enviarPeloGmail(aberto.accessToken, {
      from: aberto.from,
      to: aberto.settings.notifyEmail,
      subject: subject,
      text: text,
      html: html
    });
    return;
  }
  await aberto.transport.sendMail({
    from: aberto.from,
    to: aberto.settings.notifyEmail,
    subject: subject,
    text: text,
    html: html
  });
}

function primeiroNome(nome) {
  var parte = String(nome || '').trim().split(/\s+/)[0] || 'cliente';
  return parte.charAt(0).toUpperCase() + parte.slice(1).toLowerCase();
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtData(iso) {
  var m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '—';
  return m[3] + '/' + m[2] + '/' + m[1];
}

async function enviarEmailTeste() {
  var aberto = await abrirEnvio();
  if (!aberto) {
    var err = new Error('Conecte o Gmail do bot e salve o e-mail que recebe.');
    err.status = 400;
    throw err;
  }
  await entregar(
    aberto,
    'Mi Casa — aviso de e-mail ligado',
    'Este e-mail confirma que o painel já consegue enviar avisos de reserva.',
    '<p>Este e-mail confirma que o painel já consegue enviar avisos de reserva.</p>'
  );
  return { ok: true };
}

async function enviarEmailNovaReserva(reserva, siteBase) {
  var aberto = await abrirEnvio();
  if (!aberto) {
    console.warn('[email] Gmail não conectado — reserva salva, e-mail não enviado.');
    return { ok: false, skipped: true };
  }
  var nome = primeiroNome(reserva && reserva.nome);
  var id = reserva && reserva.id ? String(reserva.id) : '';
  var base = String(siteBase || config.publicSiteUrl || '').replace(/\/$/, '');
  var link = base + '/confirmar-reserva.html?id=' + encodeURIComponent(id);
  var quarto = reserva.quartoId || '—';
  var html =
    '<div style="font-family:Georgia,serif;background:#f4f2ed;padding:28px">' +
    '<div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:28px 24px">' +
    '<p style="margin:0;font-family:Arial,sans-serif;font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#3d6b4f">Nova reserva</p>' +
    '<h1 style="margin:10px 0 6px;font-size:34px;line-height:1.1;color:#1a1a1a">Cliente ' +
    esc(nome) +
    '</h1>' +
    '<p style="margin:0 0 18px;font-family:Arial,sans-serif;font-size:15px;color:#333">' +
    esc(quarto) +
    ' · ' +
    esc(fmtData(reserva.dataEntrada)) +
    ' a ' +
    esc(fmtData(reserva.dataSaida)) +
    '</p>' +
    '<a href="' +
    esc(link) +
    '" style="display:inline-block;background:#2d5a3d;color:#fff;text-decoration:none;font-family:Arial,sans-serif;font-weight:700;padding:14px 22px;border-radius:999px">Confirma reserva</a>' +
    '<p style="margin:18px 0 0;font-family:Arial,sans-serif;font-size:13px;color:#666">As datas continuam livres até você confirmar. Sem resposta em 3 dias, o pedido é recusado.</p>' +
    '</div></div>';

  await entregar(
    aberto,
    'Cliente ' + nome + ' — nova reserva',
    'Cliente ' +
      nome +
      '\n' +
      quarto +
      ' · ' +
      fmtData(reserva.dataEntrada) +
      ' a ' +
      fmtData(reserva.dataSaida) +
      '\n\nConfirma reserva: ' +
      link,
    html
  );
  return { ok: true };
}

module.exports = {
  enviarEmailNovaReserva: enviarEmailNovaReserva,
  enviarEmailTeste: enviarEmailTeste,
  primeiroNome: primeiroNome
};
