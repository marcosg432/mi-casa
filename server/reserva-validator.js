'use strict';

var ReservaPrecos = require('./reserva-precos');
var { normalizeQuartoId } = require('./quarto-ids');

var ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
var DDD_VALIDOS = {
  '11': 1, '12': 1, '13': 1, '14': 1, '15': 1, '16': 1, '17': 1, '18': 1, '19': 1,
  '21': 1, '22': 1, '24': 1, '27': 1, '28': 1,
  '31': 1, '32': 1, '33': 1, '34': 1, '35': 1, '37': 1, '38': 1,
  '41': 1, '42': 1, '43': 1, '44': 1, '45': 1, '46': 1, '47': 1, '48': 1, '49': 1,
  '51': 1, '53': 1, '54': 1, '55': 1,
  '61': 1, '62': 1, '63': 1, '64': 1, '65': 1, '66': 1, '67': 1, '68': 1, '69': 1,
  '71': 1, '73': 1, '74': 1, '75': 1, '77': 1, '79': 1,
  '81': 1, '82': 1, '83': 1, '84': 1, '85': 1, '86': 1, '87': 1, '88': 1, '89': 1,
  '91': 1, '92': 1, '93': 1, '94': 1, '95': 1, '96': 1, '97': 1, '98': 1, '99': 1
};

function parseIsoDate(s) {
  if (!s || !ISO_DATE.test(s)) return null;
  var p = s.split('-');
  var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  if (isNaN(d.getTime())) return null;
  return d;
}

function toIsoDate(d) {
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  );
}

function nightsBetween(startIso, endIso) {
  var a = parseIsoDate(startIso);
  var b = parseIsoDate(endIso);
  if (!a || !b || b <= a) return 0;
  return Math.round((b - a) / 86400000);
}

function telefoneValido(raw) {
  var digits = String(raw || '').replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 11) return false;
  return !!DDD_VALIDOS[digits.slice(0, 2)];
}

function sanitizeText(s, max) {
  return String(s || '')
    .trim()
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .slice(0, max);
}

function slugQuarto(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

function validarPayloadReserva(body) {
  var errors = [];
  var nome = sanitizeText(body.nome, 120);
  var email = sanitizeText(body.email, 160).toLowerCase();
  var telefone = sanitizeText(body.telefone, 30);
  var quartoId = normalizeQuartoId(slugQuarto(body.quartoId));
  var dataEntrada = sanitizeText(body.dataEntrada, 10);
  var dataSaida = sanitizeText(body.dataSaida, 10);
  var adultos = Math.max(0, Math.floor(Number(body.adultos) || Number(body.pessoas) || 0));
  var criancas = Math.max(0, Math.floor(Number(body.criancas) || 0));

  if (nome.length < 2) errors.push('Nome inválido.');
  if (!EMAIL_RE.test(email)) errors.push('E-mail inválido.');
  if (!telefoneValido(telefone)) errors.push('Telefone inválido (informe DDD).');

  var dEnt = parseIsoDate(dataEntrada);
  var dSai = parseIsoDate(dataSaida);
  if (!dEnt || !dSai) errors.push('Datas inválidas.');

  var hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  if (dEnt && dEnt < hoje) errors.push('Data de entrada não pode ser no passado.');
  if (dEnt && dSai && dSai <= dEnt) errors.push('Data de saída deve ser posterior à entrada.');

  var noites = nightsBetween(dataEntrada, dataSaida);
  if (noites <= 0) errors.push('Período inválido.');

  if (!quartoId || !ReservaPrecos.CAPACIDADE[quartoId]) {
    errors.push('Quarto inválido.');
  }

  if (errors.length) {
    return { ok: false, errors: errors };
  }

  var preco = ReservaPrecos.calcular({
    quartoId: quartoId,
    noites: noites,
    adultos: adultos,
    criancas: criancas
  });

  if (preco.erro) {
    return { ok: false, errors: [preco.erro] };
  }

  return {
    ok: true,
    data: {
      nome: nome,
      email: email,
      telefone: telefone,
      quartoId: quartoId,
      dataEntrada: dataEntrada,
      dataSaida: dataSaida,
      adultos: adultos,
      criancas: criancas,
      pessoas: adultos + criancas,
      noites: noites,
      valorDiaria: preco.valorDiaria || 0,
      valorAdicional: preco.valorAdicional || 0,
      valorTotal: preco.requerOrcamento ? 0 : preco.valorTotal || 0,
      requerOrcamento: !!preco.requerOrcamento,
      plataforma: 'site',
      metodoPagamento: 'whatsapp',
      status: 'pendente'
    }
  };
}

function normalizeReservaRow(row) {
  if (!row) return null;
  var status = String(row.status || 'pendente').toLowerCase();
  if (status === 'ativa') status = 'confirmada';
  return {
    id: row.id,
    codigo: row.codigo || '',
    nome: row.nome || '',
    email: row.email || '',
    telefone: row.telefone || '',
    pessoas: Number(row.pessoas || 1),
    adultos: Number(row.adultos != null ? row.adultos : row.pessoas || 1),
    criancas: Number(row.criancas || 0),
    dataEntrada: row.data_entrada || row.dataEntrada,
    dataSaida: row.data_saida || row.dataSaida,
    noites: Number(row.noites || 0) || undefined,
    valorDiaria: Number(row.valor_diaria != null ? row.valor_diaria : row.valorDiaria || 0),
    valorAdicional: Number(row.valor_adicional != null ? row.valor_adicional : row.valorAdicional || 0),
    valorTotal: Number(row.valor_total != null ? row.valor_total : row.valorTotal || 0),
    plataforma: (row.plataforma || 'site').toLowerCase(),
    metodoPagamento: String(row.metodo_pagamento || row.metodoPagamento || 'whatsapp').toLowerCase(),
    criadoEm: row.created_at || row.criado_em || row.criadoEm || new Date().toISOString(),
    status: status,
    quartoId: row.quarto_id || row.quartoId || null,
    requerOrcamento: !!(row.requer_orcamento || row.requerOrcamento)
  };
}

function nextCodigo(existing) {
  var set = new Set();
  (existing || []).forEach(function (r) {
    var c = String((r && r.codigo) || '').trim().toLowerCase();
    if (c) set.add(c);
  });
  for (var i = 0; i < 10000; i++) {
    var code = 'sitio-' + String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
    if (!set.has(code)) return code;
  }
  throw new Error('Não foi possível gerar código único.');
}

module.exports = {
  validarPayloadReserva: validarPayloadReserva,
  normalizeReservaRow: normalizeReservaRow,
  nextCodigo: nextCodigo,
  parseIsoDate: parseIsoDate,
  toIsoDate: toIsoDate,
  nightsBetween: nightsBetween
};
