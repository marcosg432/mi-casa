'use strict';

var { config } = require('./config');
var { getSupabaseAdmin } = require('./supabase-admin');
var localStore = require('./mesa-local-store');

function useLocalStore() {
  return !config.supabaseUrl || !config.supabaseServiceRoleKey;
}

var forceLocalMesaStore = false;

function shouldUseLocalStore() {
  return forceLocalMesaStore || useLocalStore();
}

function maybeFallbackLocal(e) {
  if (shouldUseLocalStore()) return false;
  var msg = String((e && e.message) || (e && e.code) || (e && e.details) || e || '');
  if (/does not exist|Could not find|reservas_mesa|relation.*mesas|PGRST205|42P01/i.test(msg)) {
    forceLocalMesaStore = true;
    console.warn(
      '[mesas] Tabelas Supabase ausentes — usando data/mesas-local.json. Execute migrations 011 e 012.'
    );
    return true;
  }
  return false;
}

var TOTAL_MESAS = 10;
var MAX_PESSOAS = 16;
var HORARIOS = [];
for (var h = 11; h <= 22; h++) {
  HORARIOS.push(String(h).padStart(2, '0') + ':00');
  if (h < 22) HORARIOS.push(String(h).padStart(2, '0') + ':30');
}

function calcMesasNecessarias(pessoas) {
  var p = Math.max(1, Math.min(MAX_PESSOAS, Math.floor(Number(pessoas) || 1)));
  if (p <= 4) return 1;
  if (p <= 8) return 2;
  if (p <= 12) return 3;
  return 4;
}

function formatHorario(timeVal) {
  if (!timeVal) return '';
  var s = String(timeVal);
  if (/^\d{2}:\d{2}/.test(s)) return s.slice(0, 5);
  return s;
}

function formatDataBR(isoDate) {
  if (!isoDate) return '';
  var p = String(isoDate).slice(0, 10).split('-');
  if (p.length !== 3) return isoDate;
  return p[2] + '/' + p[1] + '/' + p[0];
}

function normalizeHorarioInput(raw) {
  var s = String(raw || '').trim();
  var m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  var hh = parseInt(m[1], 10);
  var mm = parseInt(m[2], 10);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
}

function normalizeDataInput(raw) {
  var s = String(raw || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  var mFull = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (mFull) {
    return isoFromDiaMesAno(parseInt(mFull[1], 10), parseInt(mFull[2], 10), parseInt(mFull[3], 10));
  }
  var m = s.match(/^(\d{2})\/(\d{2})$/);
  if (!m) return null;
  var dd = parseInt(m[1], 10);
  var mm = parseInt(m[2], 10);
  var yyyy = new Date().getFullYear();
  var iso = isoFromDiaMesAno(dd, mm, yyyy);
  if (!iso) return null;
  if (iso < hojeISO()) {
    iso = isoFromDiaMesAno(dd, mm, yyyy + 1);
  }
  return iso;
}

function isoFromDiaMesAno(dd, mm, yyyy) {
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  var iso =
    String(yyyy) + '-' + String(mm).padStart(2, '0') + '-' + String(dd).padStart(2, '0');
  var dt = new Date(iso + 'T12:00:00');
  if (isNaN(dt.getTime())) return null;
  if (dt.getFullYear() !== yyyy || dt.getMonth() + 1 !== mm || dt.getDate() !== dd) return null;
  return iso;
}

function horarioPermitido(horario) {
  var m = String(horario || '').match(/^(\d{2}):(\d{2})$/);
  if (!m) return false;
  var hh = parseInt(m[1], 10);
  var mm = parseInt(m[2], 10);
  if (mm < 0 || mm > 59) return false;
  if (hh < 11 || hh > 22) return false;
  if (hh === 22 && mm > 0) return false;
  return true;
}

function hojeISO() {
  var now = new Date();
  return (
    String(now.getFullYear()) + '-' +
    String(now.getMonth() + 1).padStart(2, '0') + '-' +
    String(now.getDate()).padStart(2, '0')
  );
}

function horarioAtualSlot() {
  var now = new Date();
  var hh = now.getHours();
  var mm = now.getMinutes() >= 30 ? 30 : 0;
  if (hh < 11) return '11:00';
  if (hh > 22 || (hh === 22 && mm > 0)) return '22:00';
  return String(hh).padStart(2, '0') + ':' + (mm === 0 ? '00' : '30');
}

function normalizeReservaRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    nome: row.nome,
    telefone: row.telefone,
    data: String(row.data).slice(0, 10),
    horario: formatHorario(row.horario),
    pessoas: row.pessoas,
    mesasUtilizadas: row.mesas_utilizadas != null ? row.mesas_utilizadas : row.mesasUtilizadas,
    mesaIds: row.mesa_ids || row.mesaIds || [],
    status: row.status,
    createdAt: row.created_at || row.createdAt
  };
}

async function listarMesas() {
  if (shouldUseLocalStore()) {
    return localStore.listarMesas();
  }
  try {
    var sb = getSupabaseAdmin();
    var q = await sb.from('mesas').select('*').order('id', { ascending: true });
    if (q.error) throw q.error;
    return (q.data || []).map(function (m) {
      return {
        id: m.id,
        numero: m.numero,
        statusManual: m.status_manual,
        updatedAt: m.updated_at
      };
    });
  } catch (e) {
    if (maybeFallbackLocal(e)) return listarMesas();
    throw e;
  }
}

async function listarReservasMesa(filtros) {
  filtros = filtros || {};
  if (shouldUseLocalStore()) {
    return localStore.listarReservasMesa(filtros).map(normalizeReservaRow);
  }
  try {
    var sb = getSupabaseAdmin();
    var q = sb.from('reservas_mesa').select('*').order('data', { ascending: true }).order('horario', { ascending: true });
    if (filtros.data) q = q.eq('data', filtros.data);
    if (filtros.status) q = q.eq('status', filtros.status);
    if (filtros.excluirCanceladas) q = q.neq('status', 'cancelada');
    var res = await q;
    if (res.error) throw res.error;
    return (res.data || []).map(normalizeReservaRow);
  } catch (e) {
    if (maybeFallbackLocal(e)) return listarReservasMesa(filtros);
    throw e;
  }
}

async function contarMesasBloqueadasManualmente() {
  var mesas = await listarMesas();
  return mesas.filter(function (m) { return m.statusManual === 'bloqueada'; }).length;
}

function mesasOcupadasPorReservas(reservas) {
  var total = 0;
  reservas.forEach(function (r) {
    if (r.status === 'cancelada') return;
    total += r.mesasUtilizadas || r.mesas_utilizadas || 0;
  });
  return total;
}

async function getReservasAtivasNoHorario(data, horario) {
  if (shouldUseLocalStore()) {
    return localStore.getReservasAtivasNoHorario(data, horario).map(normalizeReservaRow);
  }
  try {
    var sb = getSupabaseAdmin();
    var res = await sb
      .from('reservas_mesa')
      .select('*')
      .eq('data', data)
      .in('status', ['pendente', 'confirmada']);
    if (res.error) throw res.error;
    return (res.data || [])
      .map(normalizeReservaRow)
      .filter(function (r) { return r.horario === horario; });
  } catch (e) {
    if (maybeFallbackLocal(e)) return getReservasAtivasNoHorario(data, horario);
    throw e;
  }
}

async function calcularDisponibilidade(data, horario) {
  var bloqueadas = await contarMesasBloqueadasManualmente();
  var reservas = horario
    ? await getReservasAtivasNoHorario(data, horario)
    : [];
  var ocupadasReservas = mesasOcupadasPorReservas(reservas);
  var disponiveis = Math.max(0, TOTAL_MESAS - bloqueadas - ocupadasReservas);
  return {
    total: TOTAL_MESAS,
    bloqueadas: bloqueadas,
    ocupadasReservas: ocupadasReservas,
    disponiveis: disponiveis,
    reservas: reservas
  };
}

function atribuirMesas(reservas, mesas) {
  var mapa = {};
  mesas.forEach(function (m) {
    mapa[m.id] = {
      id: m.id,
      numero: m.numero,
      status: m.statusManual === 'bloqueada' ? 'bloqueada' : 'disponivel',
      reservaId: null,
      reservaStatus: null
    };
  });

  var ordenadas = reservas.slice().sort(function (a, b) {
    if (a.status === 'confirmada' && b.status !== 'confirmada') return -1;
    if (b.status === 'confirmada' && a.status !== 'confirmada') return 1;
    return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
  });

  ordenadas.forEach(function (r) {
    if (r.status === 'cancelada') return;
    var qtd = r.mesasUtilizadas || 1;
    var idsAtribuidos = [];
    for (var i = 1; i <= TOTAL_MESAS && idsAtribuidos.length < qtd; i++) {
      var mesa = mapa[i];
      if (!mesa || mesa.status !== 'disponivel') continue;
      mesa.status = r.status === 'confirmada' ? 'ocupada' : 'pendente';
      mesa.reservaId = r.id;
      mesa.reservaStatus = r.status;
      idsAtribuidos.push(i);
    }
    r.mesaIdsAtribuidos = idsAtribuidos;
  });

  return Object.keys(mapa).sort(function (a, b) { return Number(a) - Number(b); }).map(function (k) {
    return mapa[k];
  });
}

async function getMapaMesas(data, horario, periodo) {
  var reservas;
  if (shouldUseLocalStore()) {
    reservas = localStore.listarReservasMesa({ data: data, excluirCanceladas: true }).map(normalizeReservaRow);
  } else {
    try {
      var sb = getSupabaseAdmin();
      var q = sb.from('reservas_mesa').select('*').eq('data', data).neq('status', 'cancelada');
      var res = await q;
      if (res.error) throw res.error;
      reservas = (res.data || []).map(normalizeReservaRow);
    } catch (e) {
      if (maybeFallbackLocal(e)) return getMapaMesas(data, horario, periodo);
      throw e;
    }
  }

  if (horario) {
    reservas = reservas.filter(function (r) { return r.horario === horario; });
  } else if (periodo === 'almoco') {
    reservas = reservas.filter(function (r) {
      var hh = parseInt(r.horario.split(':')[0], 10);
      return hh >= 11 && hh < 15;
    });
  } else if (periodo === 'jantar') {
    reservas = reservas.filter(function (r) {
      var hh = parseInt(r.horario.split(':')[0], 10);
      return hh >= 18;
    });
  }

  var mesas = await listarMesas();
  var mapa = atribuirMesas(reservas, mesas);
  return { mesas: mapa, reservas: reservas };
}

async function getDisponibilidadePublica(data, horario) {
  var dataUse = data || hojeISO();
  var horarioUse = horario || horarioAtualSlot();
  var disp = await calcularDisponibilidade(dataUse, horarioUse);
  return {
    total: disp.total,
    disponiveis: disp.disponiveis,
    bloqueadas: disp.bloqueadas,
    data: dataUse,
    horario: horarioUse
  };
}

async function getHorariosDisponiveis(data) {
  if (!data) return [];
  var result = [];
  for (var i = 0; i < HORARIOS.length; i++) {
    var h = HORARIOS[i];
    var disp = await calcularDisponibilidade(data, h);
    result.push({ horario: h, disponiveis: disp.disponiveis, total: disp.total });
  }
  return result;
}

function validarPayloadReservaMesa(body) {
  var errors = [];
  var nome = String(body.nome || '').trim();
  var telefone = String(body.telefone || '').trim();
  var data = normalizeDataInput(body.data);
  var horario = normalizeHorarioInput(body.horario);
  var pessoas = Math.floor(Number(body.pessoas) || 0);

  if (nome.length < 2) errors.push('Informe seu nome.');
  if (telefone.length < 8) errors.push('Informe um telefone válido.');
  if (!data) errors.push('Informe uma data válida (DD/MM).');
  if (data && data < hojeISO()) errors.push('A data deve ser hoje ou futura.');
  if (!horario || !horarioPermitido(horario)) {
    errors.push('Informe um horário válido (HH:MM, entre 11:00 e 22:00).');
  }
  if (pessoas < 1 || pessoas > MAX_PESSOAS) {
    errors.push('Informe de 1 a ' + MAX_PESSOAS + ' pessoas.');
  }

  if (errors.length) return { ok: false, errors: errors };

  return {
    ok: true,
    data: {
      nome: nome.slice(0, 120),
      telefone: telefone.slice(0, 40),
      data: data,
      horario: horario,
      pessoas: pessoas,
      mesasUtilizadas: calcMesasNecessarias(pessoas)
    }
  };
}

async function criarReservaMesa(body) {
  var valid = validarPayloadReservaMesa(body);
  if (!valid.ok) {
    var err = new Error(valid.errors.join(' '));
    err.status = 400;
    err.details = valid.errors;
    throw err;
  }

  var d = valid.data;
  if (body.mesasUtilizadas != null || body.mesas_utilizadas != null) {
    var mu = Math.floor(Number(body.mesasUtilizadas != null ? body.mesasUtilizadas : body.mesas_utilizadas));
    if (mu >= 1 && mu <= TOTAL_MESAS) d.mesasUtilizadas = mu;
  }
  if (body.status && ['pendente', 'confirmada'].indexOf(String(body.status).toLowerCase()) !== -1) {
    d.status = String(body.status).toLowerCase();
  } else {
    d.status = 'pendente';
  }

  var disp = await calcularDisponibilidade(d.data, d.horario);
  if (d.mesasUtilizadas > disp.disponiveis) {
    var errCap = new Error(
      'Não há mesas suficientes para este horário. Disponíveis: ' + disp.disponiveis + '.'
    );
    errCap.status = 409;
    throw errCap;
  }

  if (shouldUseLocalStore()) {
    var inserted = localStore.insertReserva({
      nome: d.nome,
      telefone: d.telefone,
      data: d.data,
      horario: d.horario,
      pessoas: d.pessoas,
      mesas_utilizadas: d.mesasUtilizadas,
      status: d.status
    });
    return normalizeReservaRow(inserted);
  }

  try {
    var sb = getSupabaseAdmin();
    var insert = await sb
      .from('reservas_mesa')
      .insert({
        nome: d.nome,
        telefone: d.telefone,
        data: d.data,
        horario: d.horario,
        pessoas: d.pessoas,
        mesas_utilizadas: d.mesasUtilizadas,
        status: d.status
      })
      .select('*')
      .single();

    if (insert.error) throw insert.error;
    return normalizeReservaRow(insert.data);
  } catch (e) {
    if (maybeFallbackLocal(e)) return criarReservaMesa(body);
    throw e;
  }
}

async function criarReservaMesaAdmin(body) {
  body = body || {};
  if (!body.telefone) body.telefone = 'Painel admin';
  if (!body.nome) {
    var err = new Error('Informe o nome.');
    err.status = 400;
    throw err;
  }
  body.status = body.status || 'confirmada';
  return criarReservaMesa(body);
}

async function atualizarReservaMesa(id, patch) {
  patch = patch || {};
  if (shouldUseLocalStore()) {
    var atualLocal = localStore.getReservaById(id);
    if (!atualLocal) {
      var err404l = new Error('Reserva não encontrada.');
      err404l.status = 404;
      throw err404l;
    }
    var rowLocal = {};
    if (patch.status) {
      var stl = String(patch.status).toLowerCase();
      if (['pendente', 'confirmada', 'cancelada'].indexOf(stl) === -1) {
        var errStl = new Error('Status inválido.');
        errStl.status = 400;
        throw errStl;
      }
      rowLocal.status = stl;
    }
    if (patch.mesasUtilizadas != null || patch.mesas_utilizadas != null) {
      var mul = Math.floor(Number(patch.mesasUtilizadas != null ? patch.mesasUtilizadas : patch.mesas_utilizadas));
      if (mul < 1 || mul > TOTAL_MESAS) {
        var errMul = new Error('Quantidade de mesas inválida.');
        errMul.status = 400;
        throw errMul;
      }
      rowLocal.mesas_utilizadas = mul;
    }
    if (!Object.keys(rowLocal).length) return normalizeReservaRow(atualLocal);

    var dataL = String(atualLocal.data).slice(0, 10);
    var horarioL = formatHorario(atualLocal.horario);
    var novoStatusL = rowLocal.status || atualLocal.status;
    var novasMesasL = rowLocal.mesas_utilizadas != null ? rowLocal.mesas_utilizadas : atualLocal.mesas_utilizadas;

    if (novoStatusL !== 'cancelada') {
      var reservasL = await getReservasAtivasNoHorario(dataL, horarioL);
      var ocupadasL = 0;
      reservasL.forEach(function (r) {
        if (r.id === id) return;
        ocupadasL += r.mesasUtilizadas || 0;
      });
      var bloqueadasL = await contarMesasBloqueadasManualmente();
      var livresL = TOTAL_MESAS - bloqueadasL - ocupadasL;
      if (novasMesasL > livresL) {
        var errCapL = new Error('Capacidade insuficiente para ' + novasMesasL + ' mesa(s) neste horário.');
        errCapL.status = 409;
        throw errCapL;
      }
    }

    var updLocal = localStore.updateReserva(id, rowLocal);
    return normalizeReservaRow(updLocal);
  }

  var sb = getSupabaseAdmin();
  var atual = await sb.from('reservas_mesa').select('*').eq('id', id).maybeSingle();
  if (atual.error) throw atual.error;
  if (!atual.data) {
    var err404 = new Error('Reserva não encontrada.');
    err404.status = 404;
    throw err404;
  }

  var row = {};
  if (patch.status) {
    var st = String(patch.status).toLowerCase();
    if (['pendente', 'confirmada', 'cancelada'].indexOf(st) === -1) {
      var errSt = new Error('Status inválido.');
      errSt.status = 400;
      throw errSt;
    }
    row.status = st;
  }
  if (patch.mesasUtilizadas != null || patch.mesas_utilizadas != null) {
    var mu = Math.floor(Number(patch.mesasUtilizadas != null ? patch.mesasUtilizadas : patch.mesas_utilizadas));
    if (mu < 1 || mu > TOTAL_MESAS) {
      var errMu = new Error('Quantidade de mesas inválida.');
      errMu.status = 400;
      throw errMu;
    }
    row.mesas_utilizadas = mu;
  }

  if (!Object.keys(row).length) {
    return normalizeReservaRow(atual.data);
  }

  var data = String(atual.data.data).slice(0, 10);
  var horario = formatHorario(atual.data.horario);
  var novoStatus = row.status || atual.data.status;
  var novasMesas = row.mesas_utilizadas != null ? row.mesas_utilizadas : atual.data.mesas_utilizadas;

  if (novoStatus !== 'cancelada') {
    var reservas = await getReservasAtivasNoHorario(data, horario);
    var ocupadas = 0;
    reservas.forEach(function (r) {
      if (r.id === id) return;
      ocupadas += r.mesasUtilizadas || 0;
    });
    var bloqueadas = await contarMesasBloqueadasManualmente();
    var livres = TOTAL_MESAS - bloqueadas - ocupadas;
    if (novasMesas > livres) {
      var errCap = new Error('Capacidade insuficiente para ' + novasMesas + ' mesa(s) neste horário.');
      errCap.status = 409;
      throw errCap;
    }
  }

  var upd = await sb.from('reservas_mesa').update(row).eq('id', id).select('*').single();
  if (upd.error) throw upd.error;
  return normalizeReservaRow(upd.data);
}

async function atualizarStatusMesaManual(mesaId, statusManual) {
  var id = Math.floor(Number(mesaId));
  if (id < 1 || id > TOTAL_MESAS) {
    var err = new Error('Mesa inválida.');
    err.status = 400;
    throw err;
  }
  var st = String(statusManual || '').toLowerCase();
  if (['disponivel', 'bloqueada'].indexOf(st) === -1) {
    var errSt = new Error('Status manual inválido.');
    errSt.status = 400;
    throw errSt;
  }
  if (shouldUseLocalStore()) {
    var updLocal = localStore.updateMesa(id, st);
    if (!updLocal) {
      var err404m = new Error('Mesa inválida.');
      err404m.status = 400;
      throw err404m;
    }
    return {
      id: updLocal.id,
      numero: updLocal.numero,
      statusManual: updLocal.status_manual,
      updatedAt: updLocal.updated_at
    };
  }
  var sb = getSupabaseAdmin();
  var upd = await sb
    .from('mesas')
    .update({ status_manual: st, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (upd.error) throw upd.error;
  return {
    id: upd.data.id,
    numero: upd.data.numero,
    statusManual: upd.data.status_manual,
    updatedAt: upd.data.updated_at
  };
}

async function getDashboardMesas(data, horario, periodo) {
  data = data || hojeISO();
  var mesas = await listarMesas();
  var reservasDia = await listarReservasMesa({ data: data, excluirCanceladas: true });
  var reservasTodas = await listarReservasMesa({ excluirCanceladas: true });
  var bloqueadas = mesas.filter(function (m) { return m.statusManual === 'bloqueada'; }).length;

  var datasComReserva = [];
  var seen = {};
  reservasTodas.forEach(function (r) {
    if (r.data === data || seen[r.data]) return;
    seen[r.data] = true;
    var qtd = reservasTodas.filter(function (x) { return x.data === r.data; }).length;
    datasComReserva.push({ iso: r.data, br: formatDataBR(r.data), total: qtd });
  });
  datasComReserva.sort(function (a, b) { return a.iso < b.iso ? -1 : 1; });

  var reservasFiltradas = reservasDia;
  if (horario) {
    reservasFiltradas = reservasFiltradas.filter(function (r) { return r.horario === horario; });
  } else if (periodo === 'almoco') {
    reservasFiltradas = reservasFiltradas.filter(function (r) {
      var hh = parseInt(r.horario.split(':')[0], 10);
      return hh >= 11 && hh < 15;
    });
  } else if (periodo === 'jantar') {
    reservasFiltradas = reservasFiltradas.filter(function (r) {
      var hh = parseInt(r.horario.split(':')[0], 10);
      return hh >= 18;
    });
  }

  var minDisponiveis = Math.max(0, TOTAL_MESAS - bloqueadas);
  for (var hi = 0; hi < HORARIOS.length; hi++) {
    var slot = await calcularDisponibilidade(data, HORARIOS[hi]);
    if (slot.disponiveis < minDisponiveis) minDisponiveis = slot.disponiveis;
  }

  var confirmadas = reservasFiltradas.filter(function (r) { return r.status === 'confirmada'; }).length;
  var pendentes = reservasFiltradas.filter(function (r) { return r.status === 'pendente'; }).length;
  var mesasReservadasNoDia = mesasOcupadasPorReservas(reservasDia);

  var mapa = await getMapaMesas(data, horario || null, horario ? null : periodo);

  var aviso = null;
  if (!reservasFiltradas.length && datasComReserva.length) {
    aviso =
      'Nenhuma reserva em ' + formatDataBR(data) + '. Há reservas em: ' +
      datasComReserva.map(function (d) { return d.br + ' (' + d.total + ')'; }).join(', ') + '.';
  }

  return {
    data: data,
    horario: horario || null,
    periodo: periodo || 'dia',
    aviso: aviso,
    datasComReserva: datasComReserva,
    totais: {
      mesas: TOTAL_MESAS,
      disponiveis: minDisponiveis,
      bloqueadas: bloqueadas,
      mesasReservadas: mesasReservadasNoDia,
      ocupadas: mapa.mesas.filter(function (m) { return m.status === 'ocupada'; }).length,
      pendentes: mapa.mesas.filter(function (m) { return m.status === 'pendente'; }).length,
      reservasHoje: reservasDia.length,
      reservasConfirmadas: confirmadas,
      reservasPendentes: pendentes
    },
    reservas: reservasFiltradas,
    mapa: mapa.mesas
  };
}

function buildWhatsAppMensagem(reserva) {
  var mesas =
    reserva.mesasUtilizadas != null
      ? reserva.mesasUtilizadas
      : calcMesasNecessarias(reserva.pessoas);
  return (
    'Olá, quero fazer uma reserva de mesa.\n\n' +
    'Data: ' + formatDataBR(reserva.data) + '\n' +
    'Horário: ' + reserva.horario + '\n' +
    'Quantidade de pessoas: ' + reserva.pessoas + '\n' +
    'Quantidade de mesas: ' + mesas + '\n' +
    'Nome: ' + reserva.nome + '\n' +
    'Telefone: ' + reserva.telefone
  );
}

if (shouldUseLocalStore()) {
  console.log('[mesas] Armazenamento local (data/mesas-local.json) — configure Supabase para produção.');
}

module.exports = {
  TOTAL_MESAS: TOTAL_MESAS,
  HORARIOS: HORARIOS,
  calcMesasNecessarias: calcMesasNecessarias,
  formatDataBR: formatDataBR,
  listarMesas: listarMesas,
  listarReservasMesa: listarReservasMesa,
  getDisponibilidadePublica: getDisponibilidadePublica,
  getHorariosDisponiveis: getHorariosDisponiveis,
  calcularDisponibilidade: calcularDisponibilidade,
  getMapaMesas: getMapaMesas,
  getDashboardMesas: getDashboardMesas,
  validarPayloadReservaMesa: validarPayloadReservaMesa,
  criarReservaMesa: criarReservaMesa,
  criarReservaMesaAdmin: criarReservaMesaAdmin,
  atualizarReservaMesa: atualizarReservaMesa,
  atualizarStatusMesaManual: atualizarStatusMesaManual,
  buildWhatsAppMensagem: buildWhatsAppMensagem,
  hojeISO: hojeISO
};
