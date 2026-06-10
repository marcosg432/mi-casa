'use strict';

var express = require('express');
var { config } = require('../config');
var { requireAuth } = require('../middleware/require-auth');
var {
  listarReservas,
  atualizarStatusReserva,
  listarBloqueios,
  addBloqueio,
  removeBloqueio
} = require('../reserva-service');
var { getSupabaseAdmin } = require('../supabase-admin');
var { validarPayloadReserva, normalizeReservaRow } = require('../reserva-validator');
var {
  getDashboardMesas,
  listarReservasMesa,
  atualizarReservaMesa,
  atualizarStatusMesaManual,
  listarMesas,
  criarReservaMesaAdmin,
  HORARIOS
} = require('../mesa-service');

var router = express.Router();
if (!config.disablePanelAuth) {
  router.use(requireAuth);
}

router.get('/reservas', async function (req, res) {
  try {
    var rows = await listarReservas();
    res.json(rows);
  } catch (e) {
    console.error('[admin/reservas GET]', e);
    res.status(500).json({ error: 'Erro ao listar reservas.' });
  }
});

router.patch('/reservas/:id/status', express.json(), async function (req, res) {
  try {
    var updated = await atualizarStatusReserva(req.params.id, req.body && req.body.status);
    res.json(updated);
  } catch (e) {
    console.error('[admin/reservas PATCH]', e);
    res.status(e.status || 500).json({ error: e.message || 'Erro ao atualizar status.' });
  }
});

router.get('/bloqueios', async function (req, res) {
  try {
    res.json(await listarBloqueios());
  } catch (e) {
    console.error('[admin/bloqueios GET]', e);
    res.status(500).json({ error: 'Erro ao listar bloqueios.' });
  }
});

router.post('/bloqueios', express.json(), async function (req, res) {
  try {
    var item = await addBloqueio(req.body || {});
    res.status(201).json(item);
  } catch (e) {
    console.error('[admin/bloqueios POST]', e);
    res.status(e.status || 500).json({ error: e.message || 'Erro ao criar bloqueio.' });
  }
});

router.delete('/bloqueios/:id', async function (req, res) {
  try {
    await removeBloqueio(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    console.error('[admin/bloqueios DELETE]', e);
    res.status(500).json({ error: 'Erro ao remover bloqueio.' });
  }
});

router.get('/quartos', async function (req, res) {
  try {
    var sb = getSupabaseAdmin();
    var q = await sb.from('quartos_catalog').select('*').order('ordem', { ascending: true });
    if (q.error) throw q.error;
    res.json(q.data || []);
  } catch (e) {
    res.status(500).json({ error: 'Erro ao listar quartos.' });
  }
});

router.put('/quartos/:id', express.json({ limit: '256kb' }), async function (req, res) {
  try {
    var sb = getSupabaseAdmin();
    var body = req.body || {};
    var row = {
      id: req.params.id,
      titulo: String(body.titulo || '').slice(0, 120),
      tipo: String(body.tipo || '').slice(0, 200),
      descricao: String(body.descricao || body.desc || '').slice(0, 300),
      capacidade: Math.max(1, Math.floor(Number(body.capacidade) || 1)),
      preco_display: String(body.preco_display || body.preco || 'R$ 0').slice(0, 40),
      preco_label: String(body.preco_label || body.precoLabel || 'Noite').slice(0, 40),
      imagem_principal: String(body.imagem_principal || body.img || '').slice(0, 2000),
      imagem_alt: String(body.imagem_alt || body.alt || '').slice(0, 200),
      ordem: Math.floor(Number(body.ordem) || 0),
      amenities: body.amenities && typeof body.amenities === 'object' ? body.amenities : {},
      updated_at: new Date().toISOString()
    };
    var upsert = await sb.from('quartos_catalog').upsert(row, { onConflict: 'id' }).select('*').single();
    if (upsert.error) throw upsert.error;
    res.json(upsert.data);
  } catch (e) {
    console.error('[admin/quartos PUT]', e);
    res.status(500).json({ error: 'Erro ao salvar quarto.' });
  }
});

router.delete('/quartos/:id', async function (req, res) {
  try {
    var sb = getSupabaseAdmin();
    var del = await sb.from('quartos_catalog').delete().eq('id', req.params.id);
    if (del.error) throw del.error;
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Erro ao apagar quarto.' });
  }
});

router.get('/mesas/dashboard', async function (req, res) {
  try {
    var data = req.query.data || null;
    var horario = req.query.horario || null;
    var periodo = req.query.periodo || 'dia';
    res.json(await getDashboardMesas(data, horario || null, periodo));
  } catch (e) {
    console.error('[admin/mesas/dashboard]', e);
    res.status(500).json({ error: 'Erro ao carregar painel de mesas.' });
  }
});

router.get('/mesas/reservas', async function (req, res) {
  try {
    var filtros = {};
    if (req.query.data) filtros.data = req.query.data;
    if (req.query.status) filtros.status = req.query.status;
    res.json(await listarReservasMesa(filtros));
  } catch (e) {
    console.error('[admin/mesas/reservas GET]', e);
    res.status(500).json({ error: 'Erro ao listar reservas de mesa.' });
  }
});

router.post('/mesas/reservas', express.json(), async function (req, res) {
  try {
    var created = await criarReservaMesaAdmin(req.body || {});
    res.status(201).json(created);
  } catch (e) {
    console.error('[admin/mesas/reservas POST]', e);
    res.status(e.status || 500).json({ error: e.message || 'Erro ao criar reserva de mesa.' });
  }
});

router.patch('/mesas/reservas/:id', express.json(), async function (req, res) {
  try {
    var updated = await atualizarReservaMesa(req.params.id, req.body || {});
    res.json(updated);
  } catch (e) {
    console.error('[admin/mesas/reservas PATCH]', e);
    res.status(e.status || 500).json({ error: e.message || 'Erro ao atualizar reserva.' });
  }
});

router.get('/mesas/lista', async function (req, res) {
  try {
    res.json(await listarMesas());
  } catch (e) {
    console.error('[admin/mesas/lista]', e);
    res.status(500).json({ error: 'Erro ao listar mesas.' });
  }
});

router.patch('/mesas/:id/status', express.json(), async function (req, res) {
  try {
    var statusManual = req.body && (req.body.statusManual || req.body.status);
    var updated = await atualizarStatusMesaManual(req.params.id, statusManual);
    res.json(updated);
  } catch (e) {
    console.error('[admin/mesas/status PATCH]', e);
    res.status(e.status || 500).json({ error: e.message || 'Erro ao atualizar mesa.' });
  }
});

module.exports = router;
