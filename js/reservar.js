(function () {
  var hydrateQuartosPromise =
    window.SystemStore && typeof SystemStore.hydrateQuartosSite === 'function'
      ? SystemStore.hydrateQuartosSite().catch(function (e) {
          console.warn('Quartos:', e);
        })
      : Promise.resolve();

  var config = window.SystemStore ? window.SystemStore.getConfig() : {
    valorDiaria: 150,
    valorAdicionalPorPessoa: 50,
    pessoasIncluidas: 6
  };
  /** Máximo de pessoas a mais além da capacidade do quarto. */
  var MAX_PESSOAS_EXTRAS = 3;

  /** Evita que o clique em «Pagar» fique preso se a rede não responder. */
  function withTimeoutMs(promise, ms) {
    return Promise.race([
      promise,
      new Promise(function (_, reject) {
        window.setTimeout(function () {
          reject(new Error('timeout'));
        }, ms);
      })
    ]);
  }

  var MESES = [
    'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
    'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'
  ];

  var QUARTOS_RESERVA =
    window.QUARTOS_SITE && Array.isArray(window.QUARTOS_SITE) && window.QUARTOS_SITE.length
      ? window.QUARTOS_SITE.slice()
      : [];
  if (!QUARTOS_RESERVA.length) {
    console.error('Inclua js/quartos-site.js antes de reservar.js.');
  }

  function atualizarListaQuartosReserva() {
    QUARTOS_RESERVA =
      window.QUARTOS_SITE && Array.isArray(window.QUARTOS_SITE) && window.QUARTOS_SITE.length
        ? window.QUARTOS_SITE.slice()
        : [];
  }

  var state = {
    entradaMes: null,
    saidaMes: null,
    checkIn: null,
    checkOut: null,
    ocupadas: {},
    quartoId: QUARTOS_RESERVA[0] ? QUARTOS_RESERVA[0].id : '',
    adultos: 2,
    criancas: 0,
    pessoas: 2,
    modoGrupo: false,
    nome: '',
    email: '',
    telefone: ''
  };

  var SLUG_QUARTO_LEGACY = {
    'triplo-superior': 'tem-tem',
    'suite-confort': 'soco',
    'suite-premium': 'sabia',
    'quarto-familia': 'ararajuba'
  };

  function resolveQuartoSlug(raw) {
    var s = String(raw || '')
      .trim()
      .toLowerCase()
      .replace(/_/g, '-');
    if (SLUG_QUARTO_LEGACY[s]) return SLUG_QUARTO_LEGACY[s];
    for (var i = 0; i < QUARTOS_RESERVA.length; i++) {
      if (QUARTOS_RESERVA[i].id === s) return QUARTOS_RESERVA[i].id;
    }
    return QUARTOS_RESERVA[0] ? QUARTOS_RESERVA[0].id : '';
  }

  function quartoTituloPorId(id) {
    for (var i = 0; i < QUARTOS_RESERVA.length; i++) {
      if (QUARTOS_RESERVA[i].id === id) return QUARTOS_RESERVA[i].titulo;
    }
    return '—';
  }

  function capacidadeQuartoId(id) {
    if (window.ReservaPrecos && typeof window.ReservaPrecos.getCapacidade === 'function') {
      return window.ReservaPrecos.getCapacidade(id);
    }
    for (var i = 0; i < QUARTOS_RESERVA.length; i++) {
      if (QUARTOS_RESERVA[i].id === id) {
        var c = QUARTOS_RESERVA[i].capacidade;
        if (typeof c === 'number' && c >= 1) return Math.floor(c);
      }
    }
    return 4;
  }

  function lerHospedesDoFormulario() {
    var adultosEl = document.getElementById('reservar-adultos');
    var criancasEl = document.getElementById('reservar-criancas');
    var adultos = parseInt(adultosEl && adultosEl.value, 10);
    var criancas = parseInt(criancasEl && criancasEl.value, 10);
    if (isNaN(adultos) || adultos < 1) adultos = 1;
    if (isNaN(criancas) || criancas < 0) criancas = 0;
    return { adultos: adultos, criancas: criancas };
  }

  function syncHospedesState() {
    var h = lerHospedesDoFormulario();
    var cap = capacidadeQuartoId(state.quartoId);
    if (h.adultos + h.criancas > cap) {
      if (h.adultos > cap) {
        h.adultos = cap;
        h.criancas = 0;
      } else {
        h.criancas = Math.max(0, cap - h.adultos);
      }
    }
    state.adultos = h.adultos;
    state.criancas = h.criancas;
    state.pessoas = h.adultos + h.criancas;
    var adultosEl = document.getElementById('reservar-adultos');
    var criancasEl = document.getElementById('reservar-criancas');
    if (adultosEl) {
      adultosEl.value = String(h.adultos);
      adultosEl.max = String(cap);
    }
    if (criancasEl) {
      criancasEl.value = String(h.criancas);
      criancasEl.max = String(Math.max(0, cap - h.adultos));
    }
  }

  function calcPrecoAtual() {
    syncHospedesState();
    if (!window.ReservaPrecos) {
      return {
        noites: nights(),
        valorTotal: nights() > 0 ? nights() * 150 : 0,
        requerOrcamento: nights() >= 5,
        erro: null
      };
    }
    return window.ReservaPrecos.calcular({
      quartoId: state.quartoId,
      noites: nights(),
      adultos: state.adultos,
      criancas: state.criancas
    });
  }

  function pad(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function fmtData(d) {
    if (!d) return '—';
    return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear();
  }

  function startOfToday() {
    var t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), t.getDate());
  }

  function sameDay(a, b) {
    if (!a || !b) return false;
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  function daysBetween(inicio, fim) {
    if (!inicio || !fim) return 0;
    var a = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
    var b = new Date(fim.getFullYear(), fim.getMonth(), fim.getDate());
    return Math.round((b - a) / 86400000);
  }

  function addMonths(date, delta) {
    return new Date(date.getFullYear(), date.getMonth() + delta, 1);
  }

  function parseIsoDate(value) {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    var parts = value.split('-');
    var y = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10) - 1;
    var d = parseInt(parts[2], 10);
    var dt = new Date(y, m, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== m || dt.getDate() !== d) return null;
    return dt;
  }

  function toIsoDate(date) {
    if (!date) return '';
    return (
      date.getFullYear() +
      '-' +
      pad(date.getMonth() + 1) +
      '-' +
      pad(date.getDate())
    );
  }

  function refreshOcupadasMap() {
    return refreshOcupadasMapAsync();
  }

  function refreshOcupadasMapAsync() {
    if (!window.SystemStore || !state.quartoId) {
      state.ocupadas = {};
      return Promise.resolve();
    }
    if (window.SystemStore.getOccupiedDateMapForQuarto) {
      return window.SystemStore
        .getOccupiedDateMapForQuarto(state.quartoId)
        .then(function (map) {
          state.ocupadas = map || {};
        })
        .catch(function () {
          state.ocupadas = {};
        });
    }
    state.ocupadas = {};
    return Promise.resolve();
  }

  function periodoTemConflitoLocal(entradaIso, saidaIso) {
    var conflito = false;
    var cur = state.checkIn;
    if (entradaIso && saidaIso) {
      var a = entradaIso.split('-');
      var b = saidaIso.split('-');
      cur = new Date(Number(a[0]), Number(a[1]) - 1, Number(a[2]));
      var end = new Date(Number(b[0]), Number(b[1]) - 1, Number(b[2]));
      while (cur < end) {
        var iso =
          cur.getFullYear() +
          '-' +
          String(cur.getMonth() + 1).padStart(2, '0') +
          '-' +
          String(cur.getDate()).padStart(2, '0');
        if (state.ocupadas[iso]) conflito = true;
        cur.setDate(cur.getDate() + 1);
      }
    }
    return conflito;
  }

  function getTurnstileToken() {
    var el = document.querySelector('[name="cf-turnstile-response"]');
    return el && el.value ? String(el.value) : '';
  }

  function mountTurnstileWidget() {
    var wrap = document.getElementById('reservar-turnstile-wrap');
    if (!wrap || wrap.dataset.mounted === '1') return;
    if (!window.SystemStore || !window.SystemStore.fetchPublicConfig) return;
    window.SystemStore.fetchPublicConfig()
      .then(function (cfg) {
        if (!cfg || !cfg.turnstileSiteKey) return;
        wrap.innerHTML =
          '<div class="cf-turnstile" data-sitekey="' +
          cfg.turnstileSiteKey +
          '" data-theme="light"></div>';
        wrap.dataset.mounted = '1';
        if (window.turnstile && window.turnstile.render) {
          window.turnstile.render(wrap.querySelector('.cf-turnstile'));
        }
      })
      .catch(function () {});
  }

  function nights() {
    var n = daysBetween(state.checkIn, state.checkOut);
    return n > 0 ? n : 0;
  }

  /** Valor da diária base + adicional por pessoa extra. */
  function precoDiariaPorPessoas(p) {
    var n = Math.floor(Number(p));
    if (n < 1) return 0;
    var extras = Math.max(0, n - config.pessoasIncluidas);
    return config.valorDiaria + extras * config.valorAdicionalPorPessoa;
  }

  /** Modo “pessoas a mais”: 1 a MAX_PESSOAS_EXTRAS (além da capacidade do quarto). */
  function parsePessoasExtras(raw) {
    var s = String(raw == null ? '' : raw).trim();
    if (s === '') return { valid: false, value: null };
    var v = parseInt(s, 10);
    if (isNaN(v) || v < 1 || v > MAX_PESSOAS_EXTRAS) return { valid: false, value: null };
    return { valid: true, value: v };
  }

  function getPessoasParaCalculo() {
    if (state.modoGrupo) {
      var inp = document.getElementById('reservar-input-pessoas-total');
      var parsed = parsePessoasExtras(inp && inp.value);
      if (!parsed.valid) return null;
      return capacidadeQuartoId(state.quartoId) + parsed.value;
    }
    return state.pessoas;
  }

  function totalValor() {
    var p = calcPrecoAtual();
    if (p.requerOrcamento) return null;
    return p.valorTotal != null ? p.valorTotal : 0;
  }

  /** Total estimado só do adicional (acima da diária base de 6 pessoas), em toda a estadia. */
  function valorTotalSoAdicional() {
    var p = getPessoasParaCalculo();
    var n = nights();
    if (p == null || n <= 0 || p <= config.pessoasIncluidas) return null;
    var porDia = precoDiariaPorPessoas(p) - config.valorDiaria;
    if (porDia <= 0) return null;
    return porDia * n;
  }

  function formatMoney(v) {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function lerDadosContatoDoFormulario() {
    var nomeEl = document.getElementById('reservar-nome');
    var emailEl = document.getElementById('reservar-email');
    var telEl = document.getElementById('reservar-telefone');
    return {
      nome: nomeEl ? nomeEl.value.trim() : '',
      email: emailEl ? emailEl.value.trim() : '',
      telefone: telEl ? telEl.value.trim() : ''
    };
  }

  function contatoValido(dados) {
    if (!dados.nome || !dados.email || !dados.telefone) return false;
    if (dados.nome.trim().length < 2) return false;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dados.email)) return false;
    if (!telefoneComDddValido(dados.telefone)) return false;
    return true;
  }

  function motivosBtnReservaBloqueado() {
    var motivos = [];
    var dados = lerDadosContatoDoFormulario();
    var preco = calcPrecoAtual();
    if (!state.checkIn || !state.checkOut || nights() <= 0) {
      motivos.push('escolha as datas de entrada e saída');
    }
    if (preco.erro) motivos.push(preco.erro.toLowerCase());
    if (!dados.nome || dados.nome.trim().length < 2) motivos.push('informe seu nome');
    if (!dados.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dados.email)) {
      motivos.push('informe um e-mail válido');
    }
    if (!dados.telefone || !telefoneComDddValido(dados.telefone)) {
      motivos.push('informe telefone com DDD');
    }
    return motivos;
  }

  function montarMensagemWhatsApp(reservaSalva) {
    var dados = lerDadosContatoDoFormulario();
    syncHospedesState();
    var preco = calcPrecoAtual();
    var valorTxt =
      preco.requerOrcamento && window.ReservaPrecos
        ? window.ReservaPrecos.MSG_ORCAMENTO
        : preco.valorTotal != null
          ? formatMoney(preco.valorTotal)
          : '—';
    var idReserva = reservaSalva && reservaSalva.codigo ? reservaSalva.codigo : '—';
    return (
      'Olá! Gostaria de fazer uma reserva na Mi Casa Su Casa.\n\n' +
      'Nome: ' +
      dados.nome +
      '\n' +
      'E-mail: ' +
      dados.email +
      '\n' +
      'Telefone: ' +
      dados.telefone +
      '\n' +
      'Quarto: ' +
      quartoTituloPorId(state.quartoId) +
      '\n' +
      'Entrada: ' +
      fmtData(state.checkIn) +
      '\n' +
      'Saída: ' +
      fmtData(state.checkOut) +
      '\n' +
      'Noites: ' +
      nights() +
      '\n' +
      'Adultos: ' +
      state.adultos +
      '\n' +
      'Crianças: ' +
      state.criancas +
      '\n' +
      'Valor Total: ' +
      valorTxt +
      '\n' +
      'ID da Reserva: #' +
      idReserva
    );
  }

  async function fazerReserva() {
    var dados = lerDadosContatoDoFormulario();
    syncHospedesState();
    var preco = calcPrecoAtual();
    if (!state.checkIn || !state.checkOut || nights() <= 0) {
      alert('Escolha as datas de entrada e saída.');
      return;
    }
    if (preco.erro) {
      alert(preco.erro);
      return;
    }
    if (!contatoValido(dados)) {
      alert('Verifique nome, e-mail válido e telefone com DDD.');
      return;
    }
    if (!window.SystemStore || !window.SystemStore.criarReserva) {
      alert('Sistema de reservas indisponível. Tente novamente.');
      return;
    }

    var btn = document.getElementById('btn-fazer-reserva');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Salvando…';
    }

    var entradaIso = toIsoDate(state.checkIn);
    var saidaIso = toIsoDate(state.checkOut);

    try {
      await refreshOcupadasMapAsync();
      if (periodoTemConflitoLocal(entradaIso, saidaIso)) {
        alert('Esse período já está reservado ou bloqueado para este quarto. Escolha outras datas.');
        return;
      }

      var reservaSalva = await withTimeoutMs(
        window.SystemStore.criarReserva({
          nome: dados.nome,
          email: dados.email,
          telefone: dados.telefone,
          adultos: state.adultos,
          criancas: state.criancas,
          pessoas: state.adultos + state.criancas,
          dataEntrada: entradaIso,
          dataSaida: saidaIso,
          quartoId: state.quartoId,
          plataforma: 'site',
          metodoPagamento: 'whatsapp',
          valorDiaria: preco.valorDiaria || 0,
          valorAdicional: preco.valorAdicional || 0,
          valorTotal: preco.requerOrcamento ? 0 : preco.valorTotal,
          requerOrcamento: !!preco.requerOrcamento,
          turnstileToken: getTurnstileToken()
        }),
        15000
      );

      state.nome = dados.nome;
      state.email = dados.email;
      state.telefone = dados.telefone;
      updateSidebar();

      var url =
        window.MiCasaContato && typeof window.MiCasaContato.buildWhatsAppUrl === 'function'
          ? window.MiCasaContato.buildWhatsAppUrl(montarMensagemWhatsApp(reservaSalva))
          : 'https://wa.me/559180781514?text=' +
            encodeURIComponent(montarMensagemWhatsApp(reservaSalva));
      var popup = window.open(url, '_blank', 'noopener,noreferrer');
      if (!popup) {
        alert(
          'Reserva #' +
            (reservaSalva.codigo || '') +
            ' registrada. O WhatsApp foi bloqueado — use este link: ' +
            url
        );
      }
    } catch (err) {
      console.error(err);
      alert('Não foi possível registrar a reserva. Tente novamente.');
    } finally {
      if (btn) {
        btn.textContent = 'Fazer Reserva';
        updateBtnReserva();
      }
    }
  }

  function hasNomeESobrenome(nome) {
    var partes = String(nome || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    return partes.length >= 2 && partes[0].length >= 2 && partes[1].length >= 2;
  }

  function telefoneComDddValido(raw) {
    var digits = String(raw || '').replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 11) return false;
    var ddd = digits.slice(0, 2);
    var dddsValidos = {
      '11': true, '12': true, '13': true, '14': true, '15': true, '16': true, '17': true, '18': true, '19': true,
      '21': true, '22': true, '24': true, '27': true, '28': true,
      '31': true, '32': true, '33': true, '34': true, '35': true, '37': true, '38': true,
      '41': true, '42': true, '43': true, '44': true, '45': true, '46': true,
      '47': true, '48': true, '49': true,
      '51': true, '53': true, '54': true, '55': true,
      '61': true, '62': true, '63': true, '64': true, '65': true, '66': true, '67': true, '68': true, '69': true,
      '71': true, '73': true, '74': true, '75': true, '77': true, '79': true,
      '81': true, '82': true, '83': true, '84': true, '85': true, '86': true, '87': true, '88': true, '89': true,
      '91': true, '92': true, '93': true, '94': true, '95': true, '96': true, '97': true, '98': true, '99': true
    };
    return !!dddsValidos[ddd];
  }

  function formatTelefoneBr(raw) {
    var digits = String(raw || '').replace(/\D/g, '').slice(0, 11);
    if (!digits) return '';
    if (digits.length <= 2) return '(' + digits;
    var ddd = digits.slice(0, 2);
    var resto = digits.slice(2);
    if (resto.length <= 4) return '(' + ddd + ') ' + resto;
    if (resto.length <= 8) return '(' + ddd + ') ' + resto.slice(0, 4) + '-' + resto.slice(4);
    return '(' + ddd + ') ' + resto.slice(0, 5) + '-' + resto.slice(5);
  }

  function updateMsgAdicional() {
    var el = document.getElementById('reservar-msg-adicional');
    var wrap = document.getElementById('reservar-valor-adicional-wrap');
    var strong = document.getElementById('reservar-valor-adicional');
    if (!el) return;
    var p = getPessoasParaCalculo();
    if (p == null || p <= config.pessoasIncluidas) {
      el.textContent = '';
      el.hidden = true;
      if (wrap) wrap.hidden = true;
      return;
    }
    var x = p - config.pessoasIncluidas;
    el.hidden = false;
    el.textContent =
      'Será cobrado adicional de ' +
      x +
      ' ' +
      (x === 1 ? 'pessoa' : 'pessoas') +
      '.';
    var va = valorTotalSoAdicional();
    if (wrap && strong) {
      if (va != null) {
        wrap.hidden = false;
        strong.textContent = formatMoney(va);
      } else {
        wrap.hidden = true;
      }
    }
  }

  function updateBtnContinuarPessoas() {
    var btn = document.getElementById('btn-step-pessoas');
    if (!btn) return;
    if (nights() <= 0) {
      btn.disabled = true;
      return;
    }
    if (state.modoGrupo) {
      var inp = document.getElementById('reservar-input-pessoas-total');
      btn.disabled = !parsePessoasExtras(inp && inp.value).valid;
    } else {
      btn.disabled = false;
    }
  }

  function setModoGrupo(on) {
    state.modoGrupo = on;
    var simples = document.getElementById('reservar-pessoas-simples');
    var grupo = document.getElementById('reservar-pessoas-grupo');
    if (simples) simples.hidden = on;
    if (grupo) grupo.hidden = !on;

    if (on) {
      var inpT = document.getElementById('reservar-input-pessoas-total');
      if (inpT) inpT.value = '1';
    } else {
      var cap = capacidadeQuartoId(state.quartoId);
      var inpP = document.getElementById('reservar-input-pessoas');
      if (inpP) inpP.value = String(Math.min(cap, Math.max(1, state.pessoas)));
    }
    syncPessoas();
  }

  function updateChipsDatas() {
    var chipIn = document.getElementById('reservar-chip-entrada');
    var chipOut = document.getElementById('reservar-chip-saida');
    if (chipIn) {
      chipIn.textContent = state.checkIn ? fmtData(state.checkIn) : 'Selecione no calendário abaixo';
    }
    if (chipOut) {
      chipOut.textContent = state.checkOut ? fmtData(state.checkOut) : 'Selecione no calendário abaixo';
    }
  }

  function updateSidebar() {
    var elIn = document.getElementById('reservar-sum-checkin');
    var elOut = document.getElementById('reservar-sum-checkout');
    var elN = document.getElementById('reservar-sum-noites');
    var elP = document.getElementById('reservar-sum-pessoas');
    var elT = document.getElementById('reservar-sum-total');
    var elResumo = document.getElementById('reservar-sum-resumo-contato');
    var elQuarto = document.getElementById('reservar-sum-quarto-nome');
    if (elQuarto) elQuarto.textContent = quartoTituloPorId(state.quartoId);
    if (elIn) elIn.textContent = state.checkIn ? fmtData(state.checkIn) : '—';
    if (elOut) elOut.textContent = state.checkOut ? fmtData(state.checkOut) : '—';
    if (elN) elN.textContent = nights() > 0 ? String(nights()) : '—';
    var elAd = document.getElementById('reservar-sum-adultos');
    var elCr = document.getElementById('reservar-sum-criancas');
    if (elAd) elAd.textContent = String(state.adultos);
    if (elCr) elCr.textContent = String(state.criancas);
    var preco = calcPrecoAtual();
    if (elT) {
      if (nights() <= 0) elT.textContent = '—';
      else if (preco.requerOrcamento && window.ReservaPrecos) {
        elT.textContent = window.ReservaPrecos.MSG_ORCAMENTO;
      } else if (preco.erro) {
        elT.textContent = '—';
      } else {
        elT.textContent = formatMoney(preco.valorTotal);
      }
    }
    var avisoOrc = document.getElementById('reservar-orcamento-aviso');
    if (avisoOrc) {
      avisoOrc.hidden = !(nights() > 0 && preco.requerOrcamento);
    }
    var elTarifa = document.getElementById('reservar-sum-tarifa-dica');
    if (elTarifa && window.ReservaPrecos && typeof window.ReservaPrecos.descricaoTarifaReserva === 'function') {
      elTarifa.textContent = window.ReservaPrecos.descricaoTarifaReserva(nights(), state.quartoId);
    }
    if (elResumo) {
      if (state.nome || state.email || state.telefone) {
        elResumo.hidden = false;
        elResumo.textContent =
          [state.nome, state.email, state.telefone].filter(Boolean).join(' · ');
      } else {
        elResumo.hidden = true;
      }
    }
    updateChipsDatas();
  }

  function renderCalendar(containerId, field) {
    var container = document.getElementById(containerId);
    if (!container) return;

    var view = field === 'entrada' ? state.entradaMes : state.saidaMes;
    var y = view.getFullYear();
    var m = view.getMonth();
    var firstDow = new Date(y, m, 1).getDay();
    var dim = new Date(y, m + 1, 0).getDate();
    var today = startOfToday();

    var selIn = state.checkIn;
    var selOut = state.checkOut;

    var html = '';
    html += '<div class="reservar-cal-nav">';
    html += '<button type="button" class="reservar-cal-prev" data-cal="' + field + '" aria-label="Mês anterior">‹</button>';
    html += '<div class="reservar-cal-header-inner">';
    html += '<span class="reservar-cal-year">' + y + '</span>';
    html += '<span class="reservar-cal-month">' + MESES[m] + '</span>';
    html += '</div>';
    html += '<button type="button" class="reservar-cal-next" data-cal="' + field + '" aria-label="Próximo mês">›</button>';
    html += '</div>';
    var isMobile = window.innerWidth <= 768;
    if (!isMobile) {
      html += '<div class="reservar-cal-week">DOM SEG TER QUA QUI SEX SÁB</div>';
    }
    html += '<div class="reservar-cal-grid">';

    for (var i = 0; i < firstDow; i++) {
      html += '<span class="reservar-cal-cell reservar-cal-empty"></span>';
    }
    for (var day = 1; day <= dim; day++) {
      var d = new Date(y, m, day);
      var isPast = d < today;
      var iso = toIsoDate(d);
      var isBlocked = !!state.ocupadas[iso];
      var isIn = selIn && sameDay(d, selIn);
      var isOut = selOut && sameDay(d, selOut);
      var classes = 'reservar-cal-cell reservar-cal-day';
      if (isPast) classes += ' reservar-cal-past';
      if (isBlocked) classes += ' reservar-cal-ocupado';
      if (isIn) classes += ' reservar-cal-pick-in';
      if (isOut) classes += ' reservar-cal-pick-out';
      if (!isPast && !isBlocked) {
        html += '<button type="button" class="' + classes + '" data-cal="' + field + '" data-y="' + y + '" data-m="' + m + '" data-d="' + day + '">' + day + '</button>';
      } else {
        html += '<span class="' + classes + '">' + day + '</span>';
      }
    }
    html += '</div>';

    container.innerHTML = html;

    container.querySelectorAll('.reservar-cal-prev').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (field === 'entrada') state.entradaMes = addMonths(state.entradaMes, -1);
        else state.saidaMes = addMonths(state.saidaMes, -1);
        var base = field === 'entrada' ? state.entradaMes : state.saidaMes;
        state.entradaMes = new Date(base.getFullYear(), base.getMonth(), 1);
        state.saidaMes = new Date(base.getFullYear(), base.getMonth(), 1);
        renderCalendar('cal-entrada', 'entrada');
        renderCalendar('cal-saida', 'saida');
      });
    });
    container.querySelectorAll('.reservar-cal-next').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (field === 'entrada') state.entradaMes = addMonths(state.entradaMes, 1);
        else state.saidaMes = addMonths(state.saidaMes, 1);
        var base = field === 'entrada' ? state.entradaMes : state.saidaMes;
        state.entradaMes = new Date(base.getFullYear(), base.getMonth(), 1);
        state.saidaMes = new Date(base.getFullYear(), base.getMonth(), 1);
        renderCalendar('cal-entrada', 'entrada');
        renderCalendar('cal-saida', 'saida');
      });
    });
    container.querySelectorAll('.reservar-cal-day[data-d]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var yy = parseInt(btn.getAttribute('data-y'), 10);
        var mm = parseInt(btn.getAttribute('data-m'), 10);
        var dd = parseInt(btn.getAttribute('data-d'), 10);
        var picked = new Date(yy, mm, dd);
        if (field === 'entrada') {
          state.checkIn = picked;
          state.saidaMes = new Date(yy, mm, 1);
          if (state.checkOut && state.checkOut <= state.checkIn) {
            state.checkOut = new Date(yy, mm, dd + 1);
          }
        } else {
          if (!state.checkIn) {
            alert('Escolha primeiro a data de entrada.');
            return;
          }
          if (picked <= state.checkIn) return;
          refreshOcupadasMapAsync().then(function () {
            if (periodoTemConflitoLocal(toIsoDate(state.checkIn), toIsoDate(picked))) {
              alert('Esse período contém datas já reservadas ou bloqueadas para este quarto.');
              return;
            }
            state.checkOut = picked;
            renderCalendar('cal-entrada', 'entrada');
            renderCalendar('cal-saida', 'saida');
            updateSidebar();
            updateBtnReserva();
          });
          return;
        }
        renderCalendar('cal-entrada', 'entrada');
        renderCalendar('cal-saida', 'saida');
        updateSidebar();
        updateBtnReserva();
      });
    });
  }

  function updateBtnReserva() {
    var btn = document.getElementById('btn-fazer-reserva');
    if (!btn) return;
    var motivos = motivosBtnReservaBloqueado();
    btn.disabled = motivos.length > 0;
    var hint = document.getElementById('reservar-reserva-hint');
    if (hint) {
      if (motivos.length) {
        hint.textContent = 'Para continuar: ' + motivos.join(', ') + '.';
      } else {
        hint.textContent =
          'Tudo certo — ao clicar, a reserva será salva no painel e o WhatsApp abrirá com a mensagem pronta.';
      }
    }
  }

  function updateContinuarDatas() {
    updateBtnReserva();
  }

  function showStep(step) {
    step = 1;
    var ids = ['painel-etapa-datas', 'painel-etapa-pessoas', 'painel-etapa-contato', 'painel-etapa-pagamento'];
    ids.forEach(function (id, i) {
      var el = document.getElementById(id);
      if (!el) return;
      el.hidden = i !== step - 1;
    });
    var aviso = document.getElementById('reservar-aviso-pagamento-topo');
    if (aviso) aviso.hidden = step !== 4;

    var ind = document.getElementById('reservar-passo-indicador');
    if (ind) ind.textContent = 'Reserva online';

    var sideAc = document.querySelector('.reservar-painel-acoes');
    if (sideAc) sideAc.style.display = '';

    if (step === 2) {
      updateBtnContinuarPessoas();
    }

    if (window.innerWidth <= 768) {
      var ids = ['painel-etapa-datas', 'painel-etapa-pessoas', 'painel-etapa-contato', 'painel-etapa-pagamento'];
      var target = document.getElementById(ids[step - 1]);
      if (target) {
        window.setTimeout(function () {
          target.scrollIntoView({ behavior: 'auto', block: 'start' });
        }, 80);
      }
    }
  }

  async function init() {
    atualizarListaQuartosReserva();
    if (!QUARTOS_RESERVA.length) {
      console.error('Inclua js/quartos-site.js antes de reservar.js.');
    }

    var params = new URLSearchParams(window.location.search);
    state.quartoId = resolveQuartoSlug(params.get('quarto'));

    var t = startOfToday();
    state.entradaMes = new Date(t.getFullYear(), t.getMonth(), 1);
    state.saidaMes = new Date(t.getFullYear(), t.getMonth(), 1);
    state.checkIn = null;
    state.checkOut = null;
    state.modoGrupo = false;

    function pintarCalendariosEsumario() {
      refreshOcupadasMapAsync().then(function () {
        renderCalendar('cal-entrada', 'entrada');
        renderCalendar('cal-saida', 'saida');
        updateSidebar();
        updateContinuarDatas();
      });
    }

    function aplicarQuartoPorIndice(roomIdx) {
      var q = QUARTOS_RESERVA[roomIdx];
      if (!q) return;
      state.quartoId = q.id;
      var capQ = capacidadeQuartoId(state.quartoId);
      if (state.pessoas > capQ) state.pessoas = capQ;
      if (state.pessoas < 1) state.pessoas = 1;
      state.checkIn = null;
      state.checkOut = null;
      var hoje = startOfToday();
      state.entradaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      state.saidaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      try {
        var u = new URL(window.location.href);
        u.searchParams.set('quarto', state.quartoId);
        u.searchParams.delete('entrada');
        u.searchParams.delete('saida');
        window.history.replaceState({}, '', u.pathname + u.search + u.hash);
      } catch (eUrl) {}
      pintarCalendariosEsumario();
      showStep(1);
      syncHospedesState();
    }

    pintarCalendariosEsumario();
    showStep(1);
    var pEntrada = parseIsoDate(params.get('entrada'));
    var pSaida = parseIsoDate(params.get('saida'));
    if (pEntrada && pSaida && pSaida > pEntrada) {
      state.checkIn = pEntrada;
      state.checkOut = pSaida;
      state.entradaMes = new Date(pEntrada.getFullYear(), pEntrada.getMonth(), 1);
      state.saidaMes = new Date(pSaida.getFullYear(), pSaida.getMonth(), 1);
      pintarCalendariosEsumario();
    }

    if (window.carregarImagensQuartosPastas) {
      await window.carregarImagensQuartosPastas();
    }
    initShowcaseQuartosReservar(aplicarQuartoPorIndice);

    hydrateQuartosPromise
      .then(function () {
        atualizarListaQuartosReserva();
        if (window.carregarImagensQuartosPastas) {
          return window.carregarImagensQuartosPastas();
        }
      })
      .then(function () {
        var sz = document.querySelector('[data-reservar-quarto-showcase]');
        if (sz && typeof sz._reservarShowcaseRefresh === 'function') {
          sz._reservarShowcaseRefresh();
        }
      })
      .catch(function (eH) {
        console.warn('Quartos:', eH);
      });

    var btnFazerReserva = document.getElementById('btn-fazer-reserva');
    var inpTelefone = document.getElementById('reservar-telefone');
    var inpNome = document.getElementById('reservar-nome');
    var inpEmail = document.getElementById('reservar-email');
    var inpAdultos = document.getElementById('reservar-adultos');
    var inpCriancas = document.getElementById('reservar-criancas');
    var btnAdultosMenos = document.getElementById('reservar-adultos-menos');
    var btnAdultosMais = document.getElementById('reservar-adultos-mais');
    var btnCriancasMenos = document.getElementById('reservar-criancas-menos');
    var btnCriancasMais = document.getElementById('reservar-criancas-mais');

    function onFormularioAlterado() {
      syncHospedesState();
      var dados = lerDadosContatoDoFormulario();
      state.nome = dados.nome;
      state.email = dados.email;
      state.telefone = dados.telefone;
      updateSidebar();
      updateBtnReserva();
    }

    if (inpTelefone) {
      inpTelefone.addEventListener('input', function () {
        var pos = inpTelefone.selectionStart;
        var oldLen = inpTelefone.value.length;
        inpTelefone.value = formatTelefoneBr(inpTelefone.value);
        var newLen = inpTelefone.value.length;
        var nextPos = Math.max(0, (pos || 0) + (newLen - oldLen));
        inpTelefone.setSelectionRange(nextPos, nextPos);
        onFormularioAlterado();
      });
      inpTelefone.addEventListener('blur', function () {
        inpTelefone.value = formatTelefoneBr(inpTelefone.value);
        onFormularioAlterado();
      });
    }
    if (inpNome) {
      inpNome.addEventListener('input', onFormularioAlterado);
      inpNome.addEventListener('blur', onFormularioAlterado);
    }
    if (inpEmail) {
      inpEmail.addEventListener('input', onFormularioAlterado);
      inpEmail.addEventListener('blur', onFormularioAlterado);
    }
    if (inpAdultos) {
      inpAdultos.addEventListener('input', onFormularioAlterado);
      inpAdultos.addEventListener('change', onFormularioAlterado);
    }
    if (inpCriancas) {
      inpCriancas.addEventListener('input', onFormularioAlterado);
      inpCriancas.addEventListener('change', onFormularioAlterado);
    }
    if (btnAdultosMenos) {
      btnAdultosMenos.addEventListener('click', function () {
        if (!inpAdultos) return;
        inpAdultos.value = String(Math.max(1, state.adultos - 1));
        onFormularioAlterado();
      });
    }
    if (btnAdultosMais) {
      btnAdultosMais.addEventListener('click', function () {
        if (!inpAdultos) return;
        var cap = capacidadeQuartoId(state.quartoId);
        inpAdultos.value = String(Math.min(cap, state.adultos + 1));
        onFormularioAlterado();
      });
    }
    if (btnCriancasMenos) {
      btnCriancasMenos.addEventListener('click', function () {
        if (!inpCriancas) return;
        inpCriancas.value = String(Math.max(0, state.criancas - 1));
        onFormularioAlterado();
      });
    }
    if (btnCriancasMais) {
      btnCriancasMais.addEventListener('click', function () {
        if (!inpCriancas) return;
        var cap2 = capacidadeQuartoId(state.quartoId);
        inpCriancas.value = String(Math.min(Math.max(0, cap2 - state.adultos), state.criancas + 1));
        onFormularioAlterado();
      });
    }

    if (btnFazerReserva) {
      btnFazerReserva.addEventListener('click', function () {
        if (btnFazerReserva.disabled) return;
        fazerReserva();
      });
    }

    syncHospedesState();
    updateBtnReserva();

    if (window.SystemStore && window.SystemStore.initPublico) {
      window.SystemStore.initPublico().catch(function () {});
    }
    mountTurnstileWidget();
    pintarCalendariosEsumario();
  }

  function initShowcaseQuartosReservar(onSelecionarQuarto) {
    var root = document.querySelector('[data-reservar-quarto-showcase]');
    if (!root || typeof onSelecionarQuarto !== 'function') return;
    if (typeof window.mountQuartosShowcase !== 'function') return;

    function listaQuartos() {
      var g = window.QUARTOS_SITE;
      if (g && Array.isArray(g) && g.length) return g;
      return QUARTOS_RESERVA;
    }

    function bindShowcase() {
      var L0 = listaQuartos();
      var roomIdx = 0;
      for (var ri = 0; ri < L0.length; ri++) {
        if (L0[ri].id === state.quartoId) {
          roomIdx = ri;
          break;
        }
      }
      var ctrl = window.mountQuartosShowcase(root, {
        getLista: listaQuartos,
        initialRoomIdx: roomIdx,
        onRoomChange: onSelecionarQuarto
      });
      root._reservarShowcaseCtrl = ctrl;
      root._reservarShowcaseRefresh = function () {
        var L = listaQuartos();
        if (!L.length) return;
        var idx = 0;
        for (var rj = 0; rj < L.length; rj++) {
          if (L[rj].id === state.quartoId) {
            idx = rj;
            break;
          }
        }
        if (root._reservarShowcaseCtrl && root._reservarShowcaseCtrl.setRoomIdx) {
          root._reservarShowcaseCtrl.setRoomIdx(idx);
        }
      };
    }

    if (typeof IntersectionObserver === 'undefined') {
      bindShowcase();
      return;
    }
    var showcaseIo = new IntersectionObserver(
      function (entries, observer) {
        for (var si = 0; si < entries.length; si++) {
          if (entries[si].isIntersecting) {
            observer.disconnect();
            bindShowcase();
            return;
          }
        }
      },
      { root: null, rootMargin: '200px 0px 200px 0px', threshold: 0 }
    );
    showcaseIo.observe(root);
  }

  function agendarInitReservar() {
    requestAnimationFrame(function () {
      init();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', agendarInitReservar);
  } else {
    agendarInitReservar();
  }
})();
