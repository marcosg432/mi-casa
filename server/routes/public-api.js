'use strict';

var express = require('express');
var rateLimit = require('express-rate-limit');
var { config } = require('../config');
var { verifyTurnstile } = require('../middleware/turnstile');
var {
  criarReservaValidada,
  getOccupiedDateMapForQuarto,
  verificarConflito
} = require('../reserva-service');
var { getSupabaseAdmin } = require('../supabase-admin');
var { validarPayloadReserva } = require('../reserva-validator');

var router = express.Router();
var pkg = require('../../package.json');

var SITE_BUILD = process.env.SITE_BUILD || '20260601h';

var reservaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas. Aguarde alguns minutos.' }
});

router.get('/config/public', function (req, res) {
  res.json({
    turnstileSiteKey: config.turnstileSiteKey || null,
    disablePanelAuth: !!config.disablePanelAuth,
    apiVersion: 1
  });
});

router.get('/version', function (req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.json({
    siteBuild: SITE_BUILD,
    packageVersion: pkg.version,
    reservarScript: 'reservar-flow.js',
    ok: true
  });
});

router.get('/quartos', async function (req, res) {
  try {
    var sb = getSupabaseAdmin();
    var q = await sb.from('quartos_catalog').select('*').order('ordem', { ascending: true });
    if (q.error) throw q.error;
    res.setHeader('Cache-Control', 'public, max-age=120');
    res.json(q.data || []);
  } catch (e) {
    console.error('[api/quartos]', e);
    res.status(500).json({ error: 'Não foi possível carregar quartos.' });
  }
});

router.get('/disponibilidade/:quartoId', async function (req, res) {
  try {
    var map = await getOccupiedDateMapForQuarto(req.params.quartoId);
    res.setHeader('Cache-Control', 'private, max-age=30');
    res.json(map);
  } catch (e) {
    console.error('[api/disponibilidade]', e);
    res.status(500).json({ error: 'Não foi possível carregar disponibilidade.' });
  }
});

router.post('/reservas', reservaLimiter, express.json({ limit: '32kb' }), async function (req, res) {
  try {
    var turnstile = await verifyTurnstile(
      req.body && req.body.turnstileToken,
      req.ip || req.headers['x-forwarded-for']
    );
    if (!turnstile.ok) {
      return res.status(400).json({ error: turnstile.error || 'Verificação falhou.' });
    }

    var valid = validarPayloadReserva(req.body || {});
    if (!valid.ok) {
      return res.status(400).json({ error: valid.errors.join(' '), details: valid.errors });
    }

    var conflito = await verificarConflito(
      valid.data.quartoId,
      valid.data.dataEntrada,
      valid.data.dataSaida
    );
    if (conflito) {
      return res.status(409).json({
        error: 'Esse período já está reservado ou bloqueado para este quarto.'
      });
    }

    var created = await criarReservaValidada(req.body || {});
    res.status(201).json(created);
  } catch (e) {
    console.error('[api/reservas POST]', e);
    var status = e.status || 500;
    res.status(status).json({
      error: e.message || 'Não foi possível registrar a reserva.',
      details: e.details || undefined
    });
  }
});

module.exports = router;
