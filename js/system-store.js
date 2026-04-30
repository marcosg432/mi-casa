/* Sistema com Supabase para reservas e local para apoio. */
(function (global) {
  var KEY_CONFIG = 'srp_config_v1';
  var KEY_BLOQUEIOS = 'srp_bloqueios_v1';
  var KEY_METODO_PAGAMENTO = 'srp_metodo_pagamento_v1';
  var reservasCache = [];

  function getMetodoPagamentoMap() {
    var map = readJson(KEY_METODO_PAGAMENTO, {});
    return map && typeof map === 'object' ? map : {};
  }

  function setMetodoPagamentoMap(map) {
    writeJson(KEY_METODO_PAGAMENTO, map && typeof map === 'object' ? map : {});
  }

  function saveMetodoPagamento(reserva, metodo) {
    var val = String(metodo || '').trim().toLowerCase();
    if (!val) return;
    var map = getMetodoPagamentoMap();
    if (reserva && reserva.id) map['id:' + String(reserva.id)] = val;
    if (reserva && reserva.codigo) map['codigo:' + String(reserva.codigo).toLowerCase()] = val;
    setMetodoPagamentoMap(map);
  }

  function getMetodoPagamento(row) {
    var direct = row && (row.metodo_pagamento || row.metodoPagamento);
    if (direct) return String(direct).toLowerCase();
    var map = getMetodoPagamentoMap();
    if (row && row.id && map['id:' + String(row.id)]) return map['id:' + String(row.id)];
    var codigoKey = row && row.codigo ? 'codigo:' + String(row.codigo).toLowerCase() : '';
    if (codigoKey && map[codigoKey]) return map[codigoKey];
    return 'pix';
  }

  var DEFAULT_CONFIG = {
    valorDiaria: 600,
    valorAdicionalPorPessoa: 50,
    pessoasIncluidas: 6
  };

  function readJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
    try {
      localStorage.setItem('srp_last_update', String(Date.now()));
    } catch (e) {}
  }

  function getConfig() {
    var cfg = readJson(KEY_CONFIG, null) || {};
    return {
      valorDiaria: Number(cfg.valorDiaria) > 0 ? Number(cfg.valorDiaria) : DEFAULT_CONFIG.valorDiaria,
      valorAdicionalPorPessoa:
        Number(cfg.valorAdicionalPorPessoa) >= 0
          ? Number(cfg.valorAdicionalPorPessoa)
          : DEFAULT_CONFIG.valorAdicionalPorPessoa,
      pessoasIncluidas:
        Number(cfg.pessoasIncluidas) > 0
          ? Math.floor(Number(cfg.pessoasIncluidas))
          : DEFAULT_CONFIG.pessoasIncluidas
    };
  }

  function setConfig(next) {
    var current = getConfig();
    var merged = {
      valorDiaria: next.valorDiaria != null ? Number(next.valorDiaria) : current.valorDiaria,
      valorAdicionalPorPessoa:
        next.valorAdicionalPorPessoa != null
          ? Number(next.valorAdicionalPorPessoa)
          : current.valorAdicionalPorPessoa,
      pessoasIncluidas:
        next.pessoasIncluidas != null ? Math.floor(Number(next.pessoasIncluidas)) : current.pessoasIncluidas
    };
    if (!(merged.valorDiaria > 0)) merged.valorDiaria = DEFAULT_CONFIG.valorDiaria;
    if (!(merged.valorAdicionalPorPessoa >= 0)) merged.valorAdicionalPorPessoa = DEFAULT_CONFIG.valorAdicionalPorPessoa;
    if (!(merged.pessoasIncluidas > 0)) merged.pessoasIncluidas = DEFAULT_CONFIG.pessoasIncluidas;
    writeJson(KEY_CONFIG, merged);
    return merged;
  }

  function normalizeReserva(row) {
    var qRaw = row.quarto_id != null ? row.quarto_id : row.quartoId;
    var quartoId = qRaw != null && String(qRaw).trim() !== '' ? String(qRaw).trim() : null;
    return {
      id: row.id,
      codigo: row.codigo || '',
      nome: row.nome || '',
      email: row.email || '',
      telefone: row.telefone || '',
      pessoas: Number(row.pessoas || 1),
      dataEntrada: row.data_entrada,
      dataSaida: row.data_saida,
      valorDiaria: Number(row.valor_diaria || 0),
      valorAdicional: Number(row.valor_adicional || 0),
      valorTotal: Number(row.valor_total || 0),
      plataforma: (row.plataforma || 'site').toLowerCase(),
      metodoPagamento: getMetodoPagamento(row),
      criadoEm: row.criado_em || row.created_at || new Date().toISOString(),
      status: row.status || 'ativa',
      quartoId: quartoId
    };
  }

  /** Reserva sem quarto no banco = ocupa o imóvel inteiro (todos os quartos). */
  function reservaBloqueiaQuarto(r, quartoId) {
    if (!quartoId) return true;
    var rq = r.quartoId != null && r.quartoId !== '' ? String(r.quartoId) : null;
    if (rq == null) return true;
    return rq === String(quartoId);
  }

  function getReservas() {
    return reservasCache.slice();
  }

  async function listarReservas() {
    var sb = global.SupabaseClient;
    if (!sb) throw new Error('SupabaseClient indisponivel.');
    var query = sb
      .from('reservas')
      .select('*')
      .order('created_at', { ascending: false });
    var res = await query;
    if (res.error) throw res.error;
    reservasCache = (res.data || []).map(normalizeReserva);
    return getReservas();
  }

  async function init() {
    return listarReservas();
  }

  function getBloqueios() {
    var list = readJson(KEY_BLOQUEIOS, []);
    return Array.isArray(list) ? list : [];
  }

  function setBloqueios(list) {
    writeJson(KEY_BLOQUEIOS, Array.isArray(list) ? list : []);
  }

  function makeId(prefix) {
    return (
      prefix +
      '-' +
      Date.now().toString(36) +
      '-' +
      Math.random().toString(36).slice(2, 7)
    ).toUpperCase();
  }

  function parseIsoDate(s) {
    if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
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

  function eachNight(startIso, endIso, callback) {
    var cur = parseIsoDate(startIso);
    var end = parseIsoDate(endIso);
    if (!cur || !end || end <= cur) return;
    while (cur < end) {
      callback(toIsoDate(cur));
      cur.setDate(cur.getDate() + 1);
    }
  }

  function calcReservaValores(pessoas, entradaIso, saidaIso, cfg) {
    var config = cfg || getConfig();
    var noites = nightsBetween(entradaIso, saidaIso);
    var p = Math.max(1, Math.floor(Number(pessoas) || 1));
    var extras = Math.max(0, p - config.pessoasIncluidas);
    var valorAdicional = extras * config.valorAdicionalPorPessoa * noites;
    var valorBase = config.valorDiaria * noites;
    return {
      noites: noites,
      valorDiaria: config.valorDiaria,
      valorAdicional: valorAdicional,
      valorTotal: valorBase + valorAdicional
    };
  }

  function hasRangeConflictForQuarto(startIso, endIso, quartoId) {
    var targetNights = {};
    eachNight(startIso, endIso, function (d) {
      targetNights[d] = true;
    });
    var reservas = getReservas();
    for (var i = 0; i < reservas.length; i++) {
      var r = reservas[i];
      if (r.status === 'cancelada') continue;
      if (!reservaBloqueiaQuarto(r, quartoId)) continue;
      var conflict = false;
      eachNight(r.dataEntrada, r.dataSaida, function (d) {
        if (targetNights[d]) conflict = true;
      });
      if (conflict) return true;
    }
    var bloqueios = getBloqueios();
    for (var j = 0; j < bloqueios.length; j++) {
      var b = bloqueios[j];
      var blocked = false;
      eachNight(b.dataInicio, b.dataFim, function (d) {
        if (targetNights[d]) blocked = true;
      });
      if (blocked) return true;
    }
    return false;
  }

  function hasRangeConflict(startIso, endIso) {
    return hasRangeConflictForQuarto(startIso, endIso, null);
  }

  function nextCodigo(list) {
    var existing = new Set();
    (list || []).forEach(function (r) {
      var codigo = String((r && r.codigo) || '').trim().toLowerCase();
      if (codigo) existing.add(codigo);
    });

    var tries = 0;
    while (tries < 10000) {
      var n = Math.floor(Math.random() * 1000000);
      var code = 'sitio-' + String(n).padStart(6, '0');
      if (!existing.has(code)) return code;
      tries += 1;
    }

    var base = Date.now() % 1000000;
    for (var i = 0; i < 1000000; i++) {
      var candidate = 'sitio-' + String((base + i) % 1000000).padStart(6, '0');
      if (!existing.has(candidate)) return candidate;
    }

    throw new Error('Nao foi possivel gerar codigo unico.');
  }

  async function criarReserva(payload) {
    var sb = global.SupabaseClient;
    if (!sb) throw new Error('SupabaseClient indisponivel.');
    var config = getConfig();
    var dataEntrada = payload.dataEntrada;
    var dataSaida = payload.dataSaida;
    var pessoas = Math.max(1, Math.floor(Number(payload.pessoas) || 1));
    var valores = calcReservaValores(pessoas, dataEntrada, dataSaida, config);
    var reserva = {
      codigo: payload.codigo || nextCodigo(reservasCache),
      nome: String(payload.nome || '').trim(),
      email: String(payload.email || '').trim(),
      telefone: String(payload.telefone || '').trim(),
      pessoas: pessoas,
      dataEntrada: dataEntrada,
      dataSaida: dataSaida,
      valorDiaria: valores.valorDiaria,
      valorAdicional: valores.valorAdicional,
      valorTotal: valores.valorTotal,
      plataforma: String(payload.plataforma || 'site').toLowerCase(),
      metodoPagamento: String(payload.metodoPagamento || 'pix').toLowerCase(),
      criadoEm: new Date().toISOString(),
      status: 'ativa'
    };

    var insertPayload = {
      codigo: reserva.codigo,
      nome: reserva.nome,
      email: reserva.email,
      telefone: reserva.telefone,
      pessoas: reserva.pessoas,
      data_entrada: reserva.dataEntrada,
      data_saida: reserva.dataSaida,
      valor_total: reserva.valorTotal,
      valor_diaria: reserva.valorDiaria,
      valor_adicional: reserva.valorAdicional,
      plataforma: reserva.plataforma,
      status: reserva.status
    };
    if (payload.quartoId) insertPayload.quarto_id = String(payload.quartoId);

    var inserted = await sb.from('reservas').insert(insertPayload).select('*').single();
    if (inserted.error && insertPayload.quarto_id) {
      delete insertPayload.quarto_id;
      inserted = await sb.from('reservas').insert(insertPayload).select('*').single();
    }
    if (inserted.error) throw inserted.error;
    var norm = normalizeReserva(inserted.data);
    norm.metodoPagamento = reserva.metodoPagamento;
    saveMetodoPagamento(norm, norm.metodoPagamento);
    reservasCache.unshift(norm);
    return norm;
  }

  async function cancelarReserva(id) {
    var sb = global.SupabaseClient;
    if (!sb) throw new Error('SupabaseClient indisponivel.');
    var updated = await sb
      .from('reservas')
      .update({ status: 'cancelada' })
      .eq('id', id)
      .select('*')
      .single();
    if (updated.error) throw updated.error;
    var norm = normalizeReserva(updated.data);
    reservasCache = reservasCache.map(function (r) {
      return r.id === id ? norm : r;
    });
    return norm;
  }

  function addBloqueio(payload) {
    var list = getBloqueios();
    var item = {
      id: makeId('blk'),
      dataInicio: payload.dataInicio,
      dataFim: payload.dataFim,
      motivo: String(payload.motivo || '').trim(),
      criadoEm: new Date().toISOString()
    };
    list.unshift(item);
    setBloqueios(list);
    return item;
  }

  function removeBloqueio(id) {
    var list = getBloqueios().filter(function (b) {
      return b.id !== id;
    });
    setBloqueios(list);
  }

  function searchReservas(list, q) {
    var term = String(q || '').trim().toLowerCase();
    if (!term) return list.slice();
    var termParts = term.split(/\s+/).filter(Boolean);
    return list.filter(function (r) {
      var nome = String(r.nome || '').toLowerCase();
      var codigo = String(r.codigo || '').toLowerCase();
      var email = String(r.email || '').toLowerCase();
      var telefoneDigits = String(r.telefone || '').replace(/\D/g, '');
      var searchableText = [nome, codigo, email].join(' ');

      return termParts.every(function (part) {
        var partDigits = part.replace(/\D/g, '');
        if (partDigits.length >= 2 && telefoneDigits.indexOf(partDigits) !== -1) return true;
        return searchableText.indexOf(part) !== -1;
      });
    });
  }

  function faturamentoPorPlataforma(list) {
    var base = { site: 0, booking: 0, airbnb: 0, vrbo: 0, total: 0 };
    (list || []).forEach(function (r) {
      if (r.status === 'cancelada') return;
      var p = (r.plataforma || 'site').toLowerCase();
      if (!base[p]) base[p] = 0;
      base[p] += Number(r.valorTotal) || 0;
      base.total += Number(r.valorTotal) || 0;
    });
    return base;
  }

  function getOccupiedDateMap() {
    var map = {};
    getReservas().forEach(function (r) {
      if (r.status === 'cancelada') return;
      eachNight(r.dataEntrada, r.dataSaida, function (d) {
        map[d] = 'reserva';
      });
    });
    getBloqueios().forEach(function (b) {
      eachNight(b.dataInicio, b.dataFim, function (d) {
        map[d] = 'bloqueio';
      });
    });
    return map;
  }

  function getOccupiedDateMapForQuarto(quartoId) {
    var map = {};
    if (!quartoId) return getOccupiedDateMap();
    getReservas().forEach(function (r) {
      if (r.status === 'cancelada') return;
      if (!reservaBloqueiaQuarto(r, quartoId)) return;
      eachNight(r.dataEntrada, r.dataSaida, function (d) {
        map[d] = 'reserva';
      });
    });
    getBloqueios().forEach(function (b) {
      eachNight(b.dataInicio, b.dataFim, function (d) {
        map[d] = 'bloqueio';
      });
    });
    return map;
  }

  function clearAll() {
    localStorage.removeItem(KEY_BLOQUEIOS);
    localStorage.removeItem(KEY_CONFIG);
    localStorage.removeItem(KEY_METODO_PAGAMENTO);
  }

  global.SystemStore = {
    init: init,
    listarReservas: listarReservas,
    criarReserva: criarReserva,
    getConfig: getConfig,
    setConfig: setConfig,
    getReservas: getReservas,
    getBloqueios: getBloqueios,
    addBloqueio: addBloqueio,
    removeBloqueio: removeBloqueio,
    parseIsoDate: parseIsoDate,
    toIsoDate: toIsoDate,
    nightsBetween: nightsBetween,
    calcReservaValores: calcReservaValores,
    hasRangeConflict: hasRangeConflict,
    cancelarReserva: cancelarReserva,
    searchReservas: searchReservas,
    faturamentoPorPlataforma: faturamentoPorPlataforma,
    getOccupiedDateMap: getOccupiedDateMap,
    getOccupiedDateMapForQuarto: getOccupiedDateMapForQuarto,
    hasRangeConflictForQuarto: hasRangeConflictForQuarto,
    clearAll: clearAll
  };
})(window);
