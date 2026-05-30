/* Reservas e catálogo via API + Supabase (servidor). Sem localStorage para reservas. */
(function (global) {
  var reservasCache = [];
  var bloqueiosCache = [];
  var API = '/api';

  function apiFetch(url, opts) {
    opts = opts || {};
    opts.credentials = opts.credentials || 'same-origin';
    opts.headers = Object.assign({}, opts.headers || {});
    if (opts.body && typeof opts.body === 'object' && !(opts.body instanceof FormData)) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(opts.body);
    }
    return fetch(url, opts).then(function (res) {
      return res.json().catch(function () {
        return {};
      }).then(function (data) {
        if (!res.ok) {
          var err = new Error((data && data.error) || 'Erro na API');
          err.status = res.status;
          err.details = data && data.details;
          throw err;
        }
        return data;
      });
    });
  }

  function apiFetchAdmin(url, opts) {
    opts = opts || {};
    opts.credentials = 'include';
    return apiFetch(url, opts);
  }

  var DEFAULT_CONFIG = {
    valorDiaria: 150,
    valorAdicionalPorPessoa: 50,
    pessoasIncluidas: 6
  };

  function getConfig() {
    return DEFAULT_CONFIG;
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

  function reservaBloqueiaQuarto(r, quartoId) {
    if (!quartoId) return true;
    var rq = r.quartoId != null && r.quartoId !== '' ? String(r.quartoId) : null;
    if (rq == null) return true;
    return rq === String(quartoId);
  }

  function getReservas() {
    return reservasCache.slice();
  }

  function getBloqueios() {
    return bloqueiosCache.slice();
  }

  async function listarReservas() {
    var rows = await apiFetchAdmin(API + '/admin/reservas');
    reservasCache = Array.isArray(rows) ? rows : [];
    return getReservas();
  }

  async function listarBloqueiosRemotos() {
    var rows = await apiFetchAdmin(API + '/admin/bloqueios');
    bloqueiosCache = Array.isArray(rows) ? rows : [];
    return getBloqueios();
  }

  async function init() {
    await listarReservas();
    await listarBloqueiosRemotos();
    return getReservas();
  }

  async function initPublico() {
    return Promise.resolve();
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

  async function getOccupiedDateMapForQuarto(quartoId) {
    if (!quartoId) return getOccupiedDateMap();
    try {
      return await apiFetch(API + '/disponibilidade/' + encodeURIComponent(String(quartoId)));
    } catch (e) {
      console.warn('disponibilidade', e);
      return {};
    }
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

  async function criarReserva(payload) {
    var body = Object.assign({}, payload, {
      turnstileToken: payload.turnstileToken || null
    });
    var created = await apiFetch(API + '/reservas', {
      method: 'POST',
      body: body
    });
    reservasCache.unshift(created);
    return created;
  }

  async function cancelarReserva(id) {
    return atualizarStatusReserva(id, 'cancelada');
  }

  async function atualizarStatusReserva(id, status) {
    var updated = await apiFetchAdmin(API + '/admin/reservas/' + encodeURIComponent(String(id)) + '/status', {
      method: 'PATCH',
      body: { status: status }
    });
    reservasCache = reservasCache.map(function (r) {
      return r.id === id ? updated : r;
    });
    return updated;
  }

  async function addBloqueio(payload) {
    var item = await apiFetchAdmin(API + '/admin/bloqueios', {
      method: 'POST',
      body: payload
    });
    bloqueiosCache.unshift(item);
    return item;
  }

  async function removeBloqueio(id) {
    await apiFetchAdmin(API + '/admin/bloqueios/' + encodeURIComponent(String(id)), {
      method: 'DELETE'
    });
    bloqueiosCache = bloqueiosCache.filter(function (b) {
      return b.id !== id;
    });
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
      var quartoNome = '';
      if (r.quartoId && global.QUARTOS_SITE) {
        var qMatch = global.QUARTOS_SITE.find(function (qt) {
          return String(qt.id) === String(r.quartoId);
        });
        if (qMatch) quartoNome = String(qMatch.titulo || qMatch.id || '').toLowerCase();
      }
      var searchableText = [nome, codigo, email, quartoNome, String(r.quartoId || '').toLowerCase()].join(' ');
      return termParts.every(function (part) {
        var partDigits = part.replace(/\D/g, '');
        if (partDigits.length >= 2 && telefoneDigits.indexOf(partDigits) !== -1) return true;
        if (codigo && (codigo === part || codigo.indexOf(part) !== -1)) return true;
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

  function parseAmenitiesJson(val) {
    if (val && typeof val === 'object' && !Array.isArray(val)) return val;
    if (typeof val === 'string') {
      try {
        var o = JSON.parse(val);
        return o && typeof o === 'object' ? o : {};
      } catch (e) {
        return {};
      }
    }
    return {};
  }

  function limiteDescricaoQuarto(s) {
    var lim =
      global.QUARTOS_DESC_MAX > 0 ? Math.min(300, Math.floor(Number(global.QUARTOS_DESC_MAX))) : 300;
    var t = String(s == null ? '' : s).trim();
    return t.length > lim ? t.substring(0, lim) : t;
  }

  function mapRowToQuartoSite(row) {
    var a = parseAmenitiesJson(row.amenities);
    var id = String(row.id || '').trim();
    return {
      id: id,
      titulo: row.titulo || '',
      tipo: row.tipo || '',
      desc: limiteDescricaoQuarto(row.descricao || row.desc || ''),
      capacidade: Number(row.capacidade) > 0 ? Math.floor(Number(row.capacidade)) : 2,
      preco: row.preco_display || row.preco || 'R$ 0',
      precoLabel: row.preco_label || row.precoLabel || 'Noite',
      img: row.imagem_principal || row.img || '',
      alt: row.imagem_alt || row.alt || row.titulo || '',
      verQuartoHref: 'quartos.html#quarto-' + id,
      href: 'reservar.html?quarto=' + encodeURIComponent(id),
      amenities: a,
      ordem: row.ordem != null ? Number(row.ordem) : 0
    };
  }

  function enriquecerQuartoComImagensPasta(q) {
    if (!q || typeof global.quartoImagensDaPasta !== 'function') return q;
    var id = q.id != null ? String(q.id).trim() : '';
    if (!id) return q;
    var daPasta = global.quartoImagensDaPasta(id);
    if (!daPasta || !daPasta.length) return q;
    return Object.assign({}, q, { img: daPasta[0] });
  }

  function slugifyQuartoId(raw) {
    var s = String(raw || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    s = s.replace(/-+/g, '-').replace(/^-|-$/g, '');
    return s || 'quarto';
  }

  async function hydrateQuartosSite() {
    var fb = (global.QUARTOS_SITE_FALLBACK || []).slice();
    try {
      var rows = await apiFetch(API + '/quartos');
      if (rows && rows.length) {
        global.QUARTOS_SITE = rows.map(mapRowToQuartoSite).map(enriquecerQuartoComImagensPasta);
        return global.QUARTOS_SITE;
      }
    } catch (e) {
      console.warn('hydrateQuartosSite', e);
    }
    global.QUARTOS_SITE = fb.length ? fb.map(enriquecerQuartoComImagensPasta) : [];
    return global.QUARTOS_SITE;
  }

  async function salvarQuartoCatalog(payload) {
    var id = slugifyQuartoId(payload.id);
    var row = {
      titulo: String(payload.titulo || '').trim(),
      tipo: String(payload.tipo || '').trim(),
      descricao: limiteDescricaoQuarto(payload.desc || ''),
      capacidade: Math.max(1, Math.floor(Number(payload.capacidade) || 1)),
      preco_display: String(payload.preco || 'R$ 0').trim(),
      preco_label: String(payload.precoLabel || 'Noite').trim(),
      imagem_principal: String(payload.img || '').trim(),
      imagem_alt: String(payload.alt || payload.titulo || '').trim(),
      ordem: payload.ordem != null ? Math.floor(Number(payload.ordem)) : 0,
      amenities: payload.amenities && typeof payload.amenities === 'object' ? payload.amenities : {}
    };
    await apiFetchAdmin(API + '/admin/quartos/' + encodeURIComponent(id), {
      method: 'PUT',
      body: row
    });
    await hydrateQuartosSite();
    return [{ id: id }];
  }

  async function apagarQuartoCatalog(id) {
    await apiFetchAdmin(API + '/admin/quartos/' + encodeURIComponent(String(id)), {
      method: 'DELETE'
    });
    await hydrateQuartosSite();
  }

  async function fetchPublicConfig() {
    return apiFetch(API + '/config/public');
  }

  global.SystemStore = {
    init: init,
    initPublico: initPublico,
    listarReservas: listarReservas,
    criarReserva: criarReserva,
    getConfig: getConfig,
    getReservas: getReservas,
    getBloqueios: getBloqueios,
    addBloqueio: addBloqueio,
    removeBloqueio: removeBloqueio,
    parseIsoDate: parseIsoDate,
    toIsoDate: toIsoDate,
    nightsBetween: nightsBetween,
    hasRangeConflict: hasRangeConflict,
    hasRangeConflictForQuarto: hasRangeConflictForQuarto,
    cancelarReserva: cancelarReserva,
    atualizarStatusReserva: atualizarStatusReserva,
    searchReservas: searchReservas,
    faturamentoPorPlataforma: faturamentoPorPlataforma,
    getOccupiedDateMap: getOccupiedDateMap,
    getOccupiedDateMapForQuarto: getOccupiedDateMapForQuarto,
    hydrateQuartosSite: hydrateQuartosSite,
    salvarQuartoCatalog: salvarQuartoCatalog,
    apagarQuartoCatalog: apagarQuartoCatalog,
    fetchPublicConfig: fetchPublicConfig
  };
})(window);
