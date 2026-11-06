'use strict';

var { getSupabaseAdmin } = require('./supabase-admin');
var { normalizeQuartoId, mesmoQuarto } = require('./quarto-ids');
var { reservaBloqueiaDatas, HOLD_MS } = require('./reserva-hold');
var { enviarEmailNovaReserva } = require('./reserva-email');
var {
  validarPayloadReserva,
  normalizeReservaRow,
  nextCodigo,
  parseIsoDate,
  toIsoDate
} = require('./reserva-validator');

async function expirarReservasPendentes() {
  var sb = getSupabaseAdmin();
  var pending = await sb
    .from('reservas')
    .select('id, hold_expires_at, created_at, status')
    .eq('status', 'pendente');
  if (pending.error) {
    var missHoldCol =
      String(pending.error.message || '').indexOf('hold_expires_at') !== -1 ||
      String(pending.error.code || '') === '42703';
    if (!missHoldCol) throw pending.error;
    pending = await sb
      .from('reservas')
      .select('id, created_at, status')
      .eq('status', 'pendente');
    if (pending.error) throw pending.error;
  }

  var now = Date.now();
  var ids = (pending.data || [])
    .filter(function (row) {
      var hold = row.hold_expires_at
        ? new Date(row.hold_expires_at).getTime()
        : row.created_at
          ? new Date(row.created_at).getTime() + HOLD_MS
          : 0;
      return hold > 0 && hold < now;
    })
    .map(function (row) {
      return row.id;
    });

  if (!ids.length) return 0;

  var upd = await sb.from('reservas').update({ status: 'cancelada' }).in('id', ids);
  if (upd.error) throw upd.error;
  return ids.length;
}

async function listarReservas() {
  await expirarReservasPendentes();
  var sb = getSupabaseAdmin();
  var res = await sb.from('reservas').select('*').order('created_at', { ascending: false });
  if (res.error) throw res.error;
  return (res.data || []).map(normalizeReservaRow);
}

async function buscarReservaDuplicada(data) {
  var sb = getSupabaseAdmin();
  var quarto = normalizeQuartoId(data.quartoId);
  var res = await sb
    .from('reservas')
    .select('*')
    .eq('email', data.email)
    .eq('data_entrada', data.dataEntrada)
    .eq('data_saida', data.dataSaida)
    .neq('status', 'cancelada')
    .order('created_at', { ascending: false })
    .limit(20);
  if (res.error) throw res.error;
  for (var i = 0; i < (res.data || []).length; i++) {
    var row = res.data[i];
    if (!mesmoQuarto(normalizeQuartoId(row.quarto_id), quarto)) continue;
    var normalized = normalizeReservaRow(row);
    var st = String(normalized.status || '').toLowerCase();
    if (st === 'pendente' || reservaBloqueiaDatas(normalized)) return normalized;
  }
  return null;
}

async function criarReservaValidada(payload, opts) {
  await expirarReservasPendentes();
  var valid = validarPayloadReserva(payload);
  if (!valid.ok) {
    var err = new Error(valid.errors.join(' '));
    err.status = 400;
    err.details = valid.errors;
    throw err;
  }
  var data = valid.data;

  var duplicada = await buscarReservaDuplicada(data);
  if (duplicada) return duplicada;

  var sb = getSupabaseAdmin();

  var existing = await sb.from('reservas').select('codigo');
  if (existing.error) throw existing.error;
  var codigo = nextCodigo(existing.data || []);

  var quartoId = normalizeQuartoId(data.quartoId);
  var holdExpires = new Date(Date.now() + HOLD_MS).toISOString();
  var insertRow = {
    codigo: codigo,
    nome: data.nome,
    email: data.email,
    telefone: data.telefone,
    pessoas: data.pessoas,
    adultos: data.adultos,
    criancas: data.criancas,
    data_entrada: data.dataEntrada,
    data_saida: data.dataSaida,
    noites: data.noites,
    valor_total: data.valorTotal,
    valor_diaria: data.valorDiaria,
    valor_adicional: data.valorAdicional,
    quarto_id: quartoId,
    plataforma: data.plataforma || 'site',
    status: data.status || 'pendente',
    requer_orcamento: !!data.requerOrcamento,
    metodo_pagamento: data.metodoPagamento || 'whatsapp',
    hold_expires_at: holdExpires
  };
  var inserted = await sb.from('reservas').insert(insertRow).select('*').single();
  if (inserted.error) {
    var missHold =
      String(inserted.error.message || '').indexOf('hold_expires_at') !== -1 ||
      String(inserted.error.code || '') === '42703';
    if (missHold) {
      delete insertRow.hold_expires_at;
      inserted = await sb.from('reservas').insert(insertRow).select('*').single();
    }
  }
  if (inserted.error) {
    var errMsg = String(inserted.error.message || '');
    var errCode = String(inserted.error.code || '');
    if (errCode === '23P01' || errMsg.indexOf('sobreposicao') !== -1 || errMsg.indexOf('CONFLITO') !== -1) {
      var conflict = new Error('Esse período já está confirmado ou bloqueado para este quarto.');
      conflict.status = 409;
      throw conflict;
    }
    throw inserted.error;
  }

  var criada = normalizeReservaRow(inserted.data);
  var siteBase = opts && opts.siteBase;
  enviarEmailNovaReserva(criada, siteBase).catch(function (e) {
    console.warn('[email] falha ao avisar reserva:', e.message || e);
  });
  return criada;
}

async function atualizarStatusReserva(id, status) {
  await expirarReservasPendentes();
  var next = String(status || '').toLowerCase();
  if (next !== 'pendente' && next !== 'confirmada' && next !== 'cancelada') {
    var bad = new Error('Status inválido.');
    bad.status = 400;
    throw bad;
  }
  var patch = { status: next };
  if (next === 'confirmada') patch.hold_expires_at = null;
  var sb = getSupabaseAdmin();
  var res = await sb.from('reservas').update(patch).eq('id', id).select('*').single();
  if (res.error) {
    var missHold =
      String(res.error.message || '').indexOf('hold_expires_at') !== -1 ||
      String(res.error.code || '') === '42703';
    if (missHold && next === 'confirmada') {
      res = await sb.from('reservas').update({ status: next }).eq('id', id).select('*').single();
    }
    if (res.error) {
      var upMsg = String(res.error.message || '');
      var upCode = String(res.error.code || '');
      if (upCode === '23P01' || upMsg.indexOf('sobreposicao') !== -1) {
        var taken = new Error('Esse quarto já está confirmado nessas datas.');
        taken.status = 409;
        throw taken;
      }
      throw res.error;
    }
  }
  return normalizeReservaRow(res.data);
}

function eachNight(startIso, endIso, cb) {
  var cur = parseIsoDate(startIso);
  var end = parseIsoDate(endIso);
  if (!cur || !end || end <= cur) return;
  while (cur < end) {
    cb(toIsoDate(cur));
    cur.setDate(cur.getDate() + 1);
  }
}

async function getOccupiedDateMapForQuarto(quartoId) {
  await expirarReservasPendentes();
  var sb = getSupabaseAdmin();
  var map = {};
  var targetQuarto = normalizeQuartoId(quartoId);

  /* hold_expires_at pode não existir se a migration 013 ainda não foi aplicada. */
  var reservas = await sb
    .from('reservas')
    .select('data_entrada, data_saida, status, quarto_id, created_at, hold_expires_at')
    .neq('status', 'cancelada');
  if (reservas.error) {
    var missHold =
      String(reservas.error.message || '').indexOf('hold_expires_at') !== -1 ||
      String(reservas.error.code || '') === '42703';
    if (!missHold) throw reservas.error;
    reservas = await sb
      .from('reservas')
      .select('data_entrada, data_saida, status, quarto_id, created_at')
      .neq('status', 'cancelada');
    if (reservas.error) throw reservas.error;
  }

  (reservas.data || []).forEach(function (r) {
    if (!reservaBloqueiaDatas(r)) return;
    var rq = normalizeQuartoId(r.quarto_id);
    if (targetQuarto) {
      if (rq == null) return;
      if (!mesmoQuarto(rq, targetQuarto)) return;
    }
    eachNight(r.data_entrada, r.data_saida, function (d) {
      map[d] = 'reserva';
    });
  });

  var bloqueios = await sb.from('bloqueios').select('data_inicio, data_fim');
  if (bloqueios.error) throw bloqueios.error;
  (bloqueios.data || []).forEach(function (b) {
    eachNight(b.data_inicio, b.data_fim, function (d) {
      map[d] = 'bloqueio';
    });
  });

  return map;
}

async function verificarConflito(quartoId, dataEntrada, dataSaida) {
  var map = await getOccupiedDateMapForQuarto(quartoId);
  var hit = false;
  eachNight(dataEntrada, dataSaida, function (d) {
    if (map[d]) hit = true;
  });
  return hit;
}

async function trocarQuartoReserva(id, quartoId) {
  await expirarReservasPendentes();
  var nextQuarto = normalizeQuartoId(quartoId);
  if (!nextQuarto) {
    var bad = new Error('Escolha um quarto.');
    bad.status = 400;
    throw bad;
  }
  var sb = getSupabaseAdmin();
  var atual = await sb.from('reservas').select('*').eq('id', id).single();
  if (atual.error || !atual.data) {
    var missing = new Error('Reserva não encontrada.');
    missing.status = 404;
    throw missing;
  }
  var status = String(atual.data.status || '').toLowerCase();
  if (status !== 'pendente') {
    var locked = new Error('Só dá para trocar o quarto enquanto a reserva está pendente.');
    locked.status = 400;
    throw locked;
  }
  var conflito = await verificarConflito(nextQuarto, atual.data.data_entrada, atual.data.data_saida);
  if (conflito) {
    var conflict = new Error('Esse quarto já está confirmado nessas datas.');
    conflict.status = 409;
    throw conflict;
  }
  var res = await sb.from('reservas').update({ quarto_id: nextQuarto }).eq('id', id).select('*').single();
  if (res.error) throw res.error;
  return normalizeReservaRow(res.data);
}

async function listarBloqueios() {
  var sb = getSupabaseAdmin();
  var res = await sb.from('bloqueios').select('*').order('created_at', { ascending: false });
  if (res.error) throw res.error;
  return (res.data || []).map(function (b) {
    return {
      id: b.id,
      dataInicio: b.data_inicio,
      dataFim: b.data_fim,
      motivo: b.motivo || '',
      criadoEm: b.created_at
    };
  });
}

async function addBloqueio(payload) {
  var ini = String(payload.dataInicio || '');
  var fim = String(payload.dataFim || '');
  if (!parseIsoDate(ini) || !parseIsoDate(fim) || parseIsoDate(fim) <= parseIsoDate(ini)) {
    var err = new Error('Intervalo de bloqueio inválido.');
    err.status = 400;
    throw err;
  }
  var sb = getSupabaseAdmin();
  var res = await sb
    .from('bloqueios')
    .insert({
      data_inicio: ini,
      data_fim: fim,
      motivo: String(payload.motivo || '').slice(0, 300)
    })
    .select('*')
    .single();
  if (res.error) {
    var bMsg = String(res.error.message || '');
    var bCode = String(res.error.code || '');
    if (bCode === '23P01' || bMsg.indexOf('bloqueios_sem_sobreposicao') !== -1) {
      var bConflict = new Error('Já existe um bloqueio sobreposto neste período.');
      bConflict.status = 409;
      throw bConflict;
    }
    throw res.error;
  }
  return {
    id: res.data.id,
    dataInicio: res.data.data_inicio,
    dataFim: res.data.data_fim,
    motivo: res.data.motivo || '',
    criadoEm: res.data.created_at
  };
}

async function removeBloqueio(id) {
  var sb = getSupabaseAdmin();
  var res = await sb.from('bloqueios').delete().eq('id', id);
  if (res.error) throw res.error;
}

module.exports = {
  expirarReservasPendentes: expirarReservasPendentes,
  listarReservas: listarReservas,
  criarReservaValidada: criarReservaValidada,
  atualizarStatusReserva: atualizarStatusReserva,
  trocarQuartoReserva: trocarQuartoReserva,
  getOccupiedDateMapForQuarto: getOccupiedDateMapForQuarto,
  verificarConflito: verificarConflito,
  listarBloqueios: listarBloqueios,
  addBloqueio: addBloqueio,
  removeBloqueio: removeBloqueio
};
