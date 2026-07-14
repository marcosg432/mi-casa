'use strict';

var fs = require('fs');
var path = require('path');
var crypto = require('crypto');

var DATA_DIR = path.join(__dirname, '..', 'data');
var DATA_FILE = path.join(DATA_DIR, 'mesas-local.json');

function defaultData() {
  var mesas = [];
  for (var i = 1; i <= 10; i++) {
    mesas.push({
      id: i,
      numero: String(i).padStart(2, '0'),
      status_manual: 'disponivel',
      updated_at: new Date().toISOString()
    });
  }
  return { mesas: mesas, reservas: [] };
}

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData(), null, 2), 'utf8');
  }
}

function readData() {
  ensureFile();
  try {
    var raw = fs.readFileSync(DATA_FILE, 'utf8');
    var data = JSON.parse(raw);
    if (!data.mesas || !data.reservas) return defaultData();
    return data;
  } catch (e) {
    return defaultData();
  }
}

function writeData(data) {
  ensureFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function listarMesas() {
  return readData().mesas.map(function (m) {
    return {
      id: m.id,
      numero: m.numero,
      statusManual: m.status_manual,
      updatedAt: m.updated_at
    };
  });
}

function listarReservasMesa(filtros) {
  filtros = filtros || {};
  var reservas = readData().reservas.slice();
  if (filtros.data) {
    reservas = reservas.filter(function (r) {
      return String(r.data).slice(0, 10) === String(filtros.data).slice(0, 10);
    });
  }
  if (filtros.status) {
    reservas = reservas.filter(function (r) { return r.status === filtros.status; });
  }
  if (filtros.excluirCanceladas) {
    reservas = reservas.filter(function (r) { return r.status !== 'cancelada'; });
  }
  reservas.sort(function (a, b) {
    if (a.data !== b.data) return a.data < b.data ? -1 : 1;
    return a.horario < b.horario ? -1 : 1;
  });
  return reservas;
}

function getReservasAtivasNoHorario(data, horario) {
  return listarReservasMesa({ data: data }).filter(function (r) {
    return (r.status === 'pendente' || r.status === 'confirmada') && r.horario === horario;
  });
}

function insertReserva(row) {
  var data = readData();
  var tel = String(row.telefone || '').replace(/\D/g, '');
  var dataIso = String(row.data).slice(0, 10);
  var existente = data.reservas.find(function (r) {
    if (r.status === 'cancelada') return false;
    return (
      String(r.telefone || '').replace(/\D/g, '') === tel &&
      String(r.data).slice(0, 10) === dataIso &&
      r.horario === row.horario
    );
  });
  if (existente) return existente;

  var item = {
    id: crypto.randomUUID(),
    nome: row.nome,
    telefone: row.telefone,
    data: String(row.data).slice(0, 10),
    horario: row.horario,
    pessoas: row.pessoas,
    mesas_utilizadas: row.mesas_utilizadas,
    mesa_ids: row.mesa_ids || [],
    status: row.status || 'pendente',
    created_at: new Date().toISOString()
  };
  data.reservas.push(item);
  writeData(data);
  return item;
}

function updateReserva(id, patch) {
  var data = readData();
  var idx = data.reservas.findIndex(function (r) { return r.id === id; });
  if (idx === -1) return null;
  Object.assign(data.reservas[idx], patch);
  writeData(data);
  return data.reservas[idx];
}

function getReservaById(id) {
  return readData().reservas.find(function (r) { return r.id === id; }) || null;
}

function updateMesa(id, statusManual) {
  var data = readData();
  var mesa = data.mesas.find(function (m) { return m.id === id; });
  if (!mesa) return null;
  mesa.status_manual = statusManual;
  mesa.updated_at = new Date().toISOString();
  writeData(data);
  return mesa;
}

module.exports = {
  listarMesas: listarMesas,
  listarReservasMesa: listarReservasMesa,
  getReservasAtivasNoHorario: getReservasAtivasNoHorario,
  insertReserva: insertReserva,
  updateReserva: updateReserva,
  getReservaById: getReservaById,
  updateMesa: updateMesa
};
