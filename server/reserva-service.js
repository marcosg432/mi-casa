'use strict';

var { getSupabaseAdmin } = require('./supabase-admin');
var { normalizeQuartoId, mesmoQuarto } = require('./quarto-ids');
var { reservaBloqueiaDatas } = require('./reserva-hold');
var {
  validarPayloadReserva,
  normalizeReservaRow,
  nextCodigo,
  parseIsoDate,
  toIsoDate
} = require('./reserva-validator');

async function expirarReservasPendentes() {
  var sb = getSupabaseAdmin();
  var res = await sb.rpc('expirar_reservas_pendentes');
  if (res.error) {
    if (String(res.error.message || '').indexOf('expirar_reservas_pendentes') !== -1) {
      return 0;
    }
    throw res.error;
  }
  return Number(res.data) || 0;
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
    if (reservaBloqueiaDatas(normalized)) return normalized;
  }
  return null;
}

async function criarReservaValidada(payload) {
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

  var rpc = await sb.rpc('criar_reserva_segura', {
    p_codigo: codigo,
    p_nome: data.nome,
    p_email: data.email,
    p_telefone: data.telefone,
    p_pessoas: data.pessoas,
    p_adultos: data.adultos,
    p_criancas: data.criancas,
    p_data_entrada: data.dataEntrada,
    p_data_saida: data.dataSaida,
    p_noites: data.noites,
    p_valor_total: data.valorTotal,
    p_valor_diaria: data.valorDiaria,
    p_valor_adicional: data.valorAdicional,
    p_quarto_id: data.quartoId,
    p_plataforma: data.plataforma,
    p_status: data.status,
    p_requer_orcamento: data.requerOrcamento,
    p_metodo_pagamento: data.metodoPagamento
  });

  if (rpc.error) {
    var errMsg = String(rpc.error.message || '');
    var errCode = String(rpc.error.code || '');
    if (
      errMsg.indexOf('CONFLITO_DATAS') !== -1 ||
      errMsg.indexOf('QUARTO_OBRIGATORIO') !== -1 ||
      errCode === '23P01' ||
      errCode === 'P0001'
    ) {
      var conflict = new Error('Esse período já está reservado ou bloqueado para este quarto.');
      conflict.status = 409;
      throw conflict;
    }
    throw rpc.error;
  }

  return normalizeReservaRow(rpc.data);
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
  if (res.error) throw res.error;
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

  var reservas = await sb
    .from('reservas')
    .select('data_entrada, data_saida, status, quarto_id, hold_expires_at, created_at')
    .neq('status', 'cancelada');
  if (reservas.error) throw reservas.error;

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
  await expirarReservasPendentes();
  var sb = getSupabaseAdmin();
  var res = await sb.rpc('datas_tem_conflito', {
    p_quarto_id: normalizeQuartoId(quartoId),
    p_data_entrada: dataEntrada,
    p_data_saida: dataSaida
  });
  if (res.error) throw res.error;
  return !!res.data;
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
  getOccupiedDateMapForQuarto: getOccupiedDateMapForQuarto,
  verificarConflito: verificarConflito,
  listarBloqueios: listarBloqueios,
  addBloqueio: addBloqueio,
  removeBloqueio: removeBloqueio
};
