(function () {
  if (window.__MCSC_RESERVAR_INIT) return;
  window.__MCSC_RESERVAR_INIT = true;

  var CHAVE_POS_WHATS = 'reservarPosWhatsApp';

  function fecharOverlaySucesso() {
    var ov = document.getElementById('reservar-sucesso');
    if (ov) ov.hidden = true;
    document.body.style.overflow = '';
  }

  function voltarInicioAposReserva() {
    try {
      sessionStorage.removeItem(CHAVE_POS_WHATS);
    } catch (e) {}
    fecharOverlaySucesso();
    window.location.replace('index.html');
  }

  function verificarRetornoDoWhatsApp() {
    var ov = document.getElementById('reservar-sucesso');
    var overlayAberto = ov && !ov.hidden;
    var voltouDoWhats = false;
    try {
      voltouDoWhats = sessionStorage.getItem(CHAVE_POS_WHATS) === '1';
    } catch (e) {}

    if (overlayAberto || voltouDoWhats) {
      voltarInicioAposReserva();
      return true;
    }
    return false;
  }

  window.addEventListener('pageshow', function () {
    verificarRetornoDoWhatsApp();
  });

  /** Não bloquear o parse do script: o catálogo de quartos hidrata em paralelo e é aplicado no início de init(). */
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
  var MSG_ORCAMENTO =
    window.ReservaPrecos && window.ReservaPrecos.MSG_ORCAMENTO
      ? window.ReservaPrecos.MSG_ORCAMENTO
      : 'Entre em contato para solicitar um orçamento personalizado.';

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
    pessoasAlémCap: 0,
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
      if (QUARTOS_RESERVA[i].id === id) {
        return String(QUARTOS_RESERVA[i].titulo || '').trim().toLocaleUpperCase('pt-BR');
      }
    }
    return '—';
  }

  function capacidadeQuartoId(id) {
    if (window.ReservaPrecos && window.ReservaPrecos.capacidadeQuarto) {
      return window.ReservaPrecos.capacidadeQuarto(id);
    }
    for (var i = 0; i < QUARTOS_RESERVA.length; i++) {
      if (QUARTOS_RESERVA[i].id === id) {
        var c = QUARTOS_RESERVA[i].capacidade;
        if (typeof c === 'number' && c >= 1) return Math.floor(c);
      }
    }
    return 4;
  }

  /** Máximo de adultos considerando crianças já selecionadas e a capacidade do quarto. */
  function maxAdultosParaCap(cap, criancas) {
    return Math.max(1, cap - criancas);
  }

  /** Máximo de crianças considerando adultos já selecionados e a capacidade do quarto. */
  function maxCriancasParaCap(cap, adultos) {
    return Math.max(0, cap - adultos);
  }

  function clampHospedesAoCap(cap, adultos, criancas) {
    var a = Math.max(1, Math.floor(Number(adultos) || 1));
    var c = Math.max(0, Math.floor(Number(criancas) || 0));
    c = Math.min(c, maxCriancasParaCap(cap, a));
    a = Math.min(a, maxAdultosParaCap(cap, c));
    c = Math.min(c, maxCriancasParaCap(cap, a));
    return { adultos: a, criancas: c };
  }

  function calcPrecoAtual() {
    if (!window.ReservaPrecos || !window.ReservaPrecos.calcReserva) {
      return { valorTotal: 0, requerOrcamento: false, noites: nights() };
    }
    return window.ReservaPrecos.calcReserva({
      quartoId: state.quartoId,
      noites: nights(),
      adultos: state.adultos,
      criancas: state.criancas,
      pessoasAlémCap: state.modoGrupo ? state.pessoasAlémCap : 0
    });
  }

  var BTN_FINALIZAR_WHATS = 'Finalizar no WhatsApp';

  function montarReservaParaWhatsApp(reservaCriada) {
    var calc = calcPrecoAtual();
    return Object.assign({}, reservaCriada, {
      nome: state.nome,
      email: state.email,
      telefone: state.telefone,
      quartoId: state.quartoId,
      quartoTitulo: quartoTituloPorId(state.quartoId),
      dataEntrada: reservaCriada.dataEntrada || toIsoDate(state.checkIn),
      dataSaida: reservaCriada.dataSaida || toIsoDate(state.checkOut),
      noites: nights(),
      adultos: state.adultos,
      criancas: state.criancas,
      requerOrcamento: !!calc.requerOrcamento,
      valorTotal: calc.requerOrcamento ? calc.valorMedio : calc.valorTotal,
      valorMin: calc.valorMin,
      valorMax: calc.valorMax
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

  function refreshOcupadasMapAsync() {
    if (!window.SystemStore || !state.quartoId) {
      state.ocupadas = {};
      return Promise.resolve();
    }
    if (window.SystemStore.getOccupiedDateMapForQuarto) {
      return window.SystemStore.getOccupiedDateMapForQuarto(state.quartoId)
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

  function refreshOcupadasMap() {
    return refreshOcupadasMapAsync();
  }

  function periodoTemConflitoLocal(entradaIso, saidaIso) {
    if (!entradaIso || !saidaIso) return false;
    var a = entradaIso.split('-');
    var b = saidaIso.split('-');
    var cur = new Date(Number(a[0]), Number(a[1]) - 1, Number(a[2]));
    var end = new Date(Number(b[0]), Number(b[1]) - 1, Number(b[2]));
    while (cur < end) {
      var iso =
        cur.getFullYear() +
        '-' +
        String(cur.getMonth() + 1).padStart(2, '0') +
        '-' +
        String(cur.getDate()).padStart(2, '0');
      if (state.ocupadas[iso]) return true;
      cur.setDate(cur.getDate() + 1);
    }
    return false;
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
        function renderWidget() {
          var el = wrap.querySelector('.cf-turnstile');
          if (el && window.turnstile && window.turnstile.render) {
            window.turnstile.render(el);
            return true;
          }
          return false;
        }
        if (!renderWidget()) {
          var tries = 0;
          var timer = window.setInterval(function () {
            tries += 1;
            if (renderWidget() || tries > 40) window.clearInterval(timer);
          }, 250);
        }
      })
      .catch(function () {});
  }

  function gerarCodigoReservaLocal() {
    return 'WEB-' + Date.now().toString(36).toUpperCase().slice(-8);
  }

  function tentarRegistrarReservaPainel(entradaIso, saidaIso, preco) {
    if (!window.SystemStore || !window.SystemStore.criarReserva) {
      return Promise.resolve(null);
    }
    return withTimeoutMs(
      SystemStore.criarReserva({
        nome: state.nome,
        email: state.email,
        telefone: state.telefone,
        adultos: state.adultos,
        criancas: state.criancas,
        pessoasAlémCap: state.modoGrupo ? state.pessoasAlémCap : 0,
        dataEntrada: entradaIso,
        dataSaida: saidaIso,
        plataforma: 'site',
        metodoPagamento: 'whatsapp',
        quartoId: state.quartoId,
        valorDiaria: preco.valorDiaria || 0,
        valorAdicional: preco.valorAdicional || 0,
        valorTotal: preco.requerOrcamento ? 0 : preco.valorTotal,
        requerOrcamento: !!preco.requerOrcamento,
        turnstileToken: getTurnstileToken()
      }),
      3500
    ).catch(function (errApi) {
      console.warn('Registro no painel falhou; abrindo WhatsApp mesmo assim.', errApi);
      return null;
    });
  }

  function abrirWhatsAppComReserva(reservaObj) {
    var waUrl =
      window.ReservaPrecos && window.ReservaPrecos.buildWhatsAppUrl
        ? window.ReservaPrecos.buildWhatsAppUrl(reservaObj)
        : null;
    if (!waUrl) {
      alert('Não foi possível abrir o WhatsApp.');
      return false;
    }
    var ov = document.getElementById('reservar-sucesso');
    if (ov) {
      ov.hidden = false;
      document.body.style.overflow = 'hidden';
      var titulo = document.getElementById('reservar-sucesso-titulo');
      if (titulo) {
        titulo.textContent =
          'Reserva #' + (reservaObj.codigo || '—') + ' — abrindo WhatsApp…';
      }
    }
    window.setTimeout(function () {
      try {
        sessionStorage.setItem(CHAVE_POS_WHATS, '1');
      } catch (e) {}
      window.location.href = waUrl;
    }, 800);
    return true;
  }

  function nights() {
    var n = daysBetween(state.checkIn, state.checkOut);
    return n > 0 ? n : 0;
  }

  /** Valor da diária base + adicional por pessoa extra. @deprecated use calcPrecoAtual */
  function precoDiariaPorPessoas(p) {
    var calc = calcPrecoAtual();
    if (calc.requerOrcamento) return 0;
    var n = nights();
    if (n <= 0) return 0;
    return calc.valorTotal / n;
  }

  function valorTotalSoAdicional() {
    var calc = calcPrecoAtual();
    return calc.valorAdicional > 0 ? calc.valorAdicional : null;
  }

  /** Modo “pessoas a mais”: 1 a MAX_PESSOAS_EXTRAS (além da capacidade do quarto). */
  function parsePessoasExtras(raw) {
    var s = String(raw == null ? '' : raw).trim();
    if (s === '') return { valid: false, value: null };
    var v = parseInt(s, 10);
    if (isNaN(v) || v < 1 || v > MAX_PESSOAS_EXTRAS) return { valid: false, value: null };
    return { valid: true, value: v };
  }

  function totalValor() {
    var p = calcPrecoAtual();
    if (p.requerOrcamento || p.valorTotal == null) return null;
    return p.valorTotal;
  }

  function requerOrcamentoPersonalizado() {
    return !!calcPrecoAtual().requerOrcamento;
  }

  function formatValorReserva() {
    var calc = calcPrecoAtual();
    if (calc.requerOrcamento) {
      if (
        window.ReservaPrecos &&
        window.ReservaPrecos.formatFaixaOrcamentoTexto &&
        calc.valorMin > 0 &&
        calc.valorMax > 0
      ) {
        return window.ReservaPrecos.formatFaixaOrcamentoTexto(calc);
      }
      if (calc.valorTotal != null && calc.valorTotal > 0) {
        return formatMoney(calc.valorTotal) + ' · valor médio (orçamento)';
      }
      return MSG_ORCAMENTO;
    }
    var v = calc.valorTotal;
    return v != null && v > 0 ? formatMoney(v) : '—';
  }

  function formatMoney(v) {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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
    var msgOrc = document.getElementById('reservar-msg-orcamento');
    var calc = calcPrecoAtual();

    if (msgOrc) {
      if (calc.requerOrcamento) {
        msgOrc.hidden = false;
        msgOrc.textContent = MSG_ORCAMENTO;
      } else {
        msgOrc.hidden = true;
        msgOrc.textContent = '';
      }
    }

    if (!el) return;
    if (!calc.pessoasAlémCap || calc.pessoasAlémCap <= 0) {
      el.textContent = '';
      el.hidden = true;
      if (wrap) wrap.hidden = true;
      return;
    }
    var x = calc.pessoasAlémCap;
    el.hidden = false;
    el.textContent =
      'Será cobrado um adicional por ' +
      x +
      ' ' +
      (x === 1 ? 'pessoa' : 'pessoas') +
      ' além da capacidade do quarto.';
    var va = valorTotalSoAdicional();
    if (wrap && strong) {
      if (va != null && !calc.requerOrcamento) {
        wrap.hidden = false;
        strong.textContent = formatMoney(va);
      } else {
        wrap.hidden = true;
      }
    }
  }

  function hospedesValidos() {
    if (state.modoGrupo) {
      return parsePessoasExtras(
        document.getElementById('reservar-input-pessoas-total') &&
          document.getElementById('reservar-input-pessoas-total').value
      ).valid;
    }
    var cap = capacidadeQuartoId(state.quartoId);
    return state.adultos >= 1 && state.adultos + state.criancas <= cap;
  }

  function updateBtnContinuarPessoas() {
    var btn = document.getElementById('btn-step-pessoas');
    if (!btn) return;
    if (nights() <= 0) {
      btn.disabled = true;
      return;
    }
    btn.disabled = !hospedesValidos();
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
      state.pessoasAlémCap = 1;
    } else {
      state.pessoasAlémCap = 0;
      var cap = capacidadeQuartoId(state.quartoId);
      var clamped = clampHospedesAoCap(cap, state.adultos, state.criancas);
      state.adultos = clamped.adultos;
      state.criancas = clamped.criancas;
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
    var elA = document.getElementById('reservar-sum-adultos');
    var elC = document.getElementById('reservar-sum-criancas');
    var elT = document.getElementById('reservar-sum-total');
    var elResumo = document.getElementById('reservar-sum-resumo-contato');
    var elQuarto = document.getElementById('reservar-sum-quarto-nome');
    if (elQuarto) elQuarto.textContent = quartoTituloPorId(state.quartoId);
    if (elIn) elIn.textContent = state.checkIn ? fmtData(state.checkIn) : '—';
    if (elOut) elOut.textContent = state.checkOut ? fmtData(state.checkOut) : '—';
    if (elN) elN.textContent = nights() > 0 ? String(nights()) : '—';
    if (elA) elA.textContent = String(state.adultos);
    if (elC) elC.textContent = String(state.criancas);
    if (elT) elT.textContent = nights() > 0 && hospedesValidos() ? formatValorReserva() : '—';
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
          var saidaIsoPick = toIsoDate(picked);
          refreshOcupadasMapAsync().then(function () {
            if (periodoTemConflitoLocal(toIsoDate(state.checkIn), saidaIsoPick)) {
              alert('Esse período contém datas já reservadas ou bloqueadas para este quarto.');
              return;
            }
            state.checkOut = picked;
            renderCalendar('cal-entrada', 'entrada');
            renderCalendar('cal-saida', 'saida');
            updateSidebar();
            updateContinuarDatas();
          });
          return;
        }
        renderCalendar('cal-entrada', 'entrada');
        renderCalendar('cal-saida', 'saida');
        updateSidebar();
        updateContinuarDatas();
      });
    });
  }

  function updateContinuarDatas() {
    var btn = document.getElementById('btn-step-datas');
    if (!btn) return;
    var ok = state.checkIn && state.checkOut && state.checkOut > state.checkIn;
    btn.disabled = !ok;
  }

  function showStep(step) {
    var ids = ['painel-etapa-datas', 'painel-etapa-pessoas', 'painel-etapa-contato', 'painel-etapa-confirmacao'];
    ids.forEach(function (id, i) {
      var el = document.getElementById(id);
      if (!el) return;
      el.hidden = i !== step - 1;
    });
    var aviso = document.getElementById('reservar-aviso-pagamento-topo');
    if (aviso) aviso.hidden = step !== 4;

    var ind = document.getElementById('reservar-passo-indicador');
    if (ind) ind.textContent = 'Passo ' + step + ' de 4';

    var sideAc = document.querySelector('.reservar-painel-acoes');
    if (sideAc) sideAc.style.display = step === 1 ? '' : 'none';

    if (step === 2) {
      updateBtnContinuarPessoas();
    }
    if (step === 4) {
      renderConfirmacaoResumo();
      mountTurnstileWidget();
    }

    if (window.innerWidth <= 768) {
      var target = document.getElementById(ids[step - 1]);
      if (target) {
        window.setTimeout(function () {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 80);
      }
    }
  }

  function renderConfirmacaoResumo() {
    var box = document.getElementById('reservar-confirmacao-resumo');
    if (!box) return;
    var calc = calcPrecoAtual();
    box.innerHTML =
      '<p><strong>Quarto:</strong> ' +
      quartoTituloPorId(state.quartoId) +
      '</p>' +
      '<p><strong>Entrada:</strong> ' +
      (state.checkIn ? fmtData(state.checkIn) : '—') +
      ' · <strong>Saída:</strong> ' +
      (state.checkOut ? fmtData(state.checkOut) : '—') +
      '</p>' +
      '<p><strong>Noites:</strong> ' +
      nights() +
      ' · <strong>Adultos:</strong> ' +
      state.adultos +
      ' · <strong>Crianças:</strong> ' +
      state.criancas +
      '</p>' +
      '<p><strong>' +
      (calc.requerOrcamento ? 'Orçamento (de 5 noites ou mais)' : 'Valor') +
      ':</strong> ' +
      formatValorReserva() +
      '</p>' +
      '<p><strong>Contato:</strong> ' +
      [state.nome, state.email, state.telefone].filter(Boolean).join(' · ') +
      '</p>';
    if (calc.pessoasAlémCap > 0) {
      box.innerHTML +=
        '<p><em>Inclui ' + calc.pessoasAlémCap + ' pessoa(s) além da capacidade do quarto.</em></p>';
    }
  }

  async function init() {
    if (verificarRetornoDoWhatsApp()) return;

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
      if (!state.modoGrupo) {
        var clampQ = clampHospedesAoCap(capQ, state.adultos, state.criancas);
        state.adultos = clampQ.adultos;
        state.criancas = clampQ.criancas;
      }
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
      var ipAd = document.getElementById('reservar-input-adultos');
      var ipCr = document.getElementById('reservar-input-criancas');
      if (ipAd) ipAd.value = String(state.adultos);
      if (ipCr) ipCr.value = String(state.criancas);
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
      var capUrl = capacidadeQuartoId(state.quartoId);
      if (!state.modoGrupo) {
        var clampUrl = clampHospedesAoCap(capUrl, state.adultos, state.criancas);
        state.adultos = clampUrl.adultos;
        state.criancas = clampUrl.criancas;
      }
      pintarCalendariosEsumario();
      showStep(2);
    }

    if (window.carregarImagensQuartosPastas) {
      await window.carregarImagensQuartosPastas();
    }
    initShowcaseQuartosReservar(aplicarQuartoPorIndice);

    hydrateQuartosPromise
      .then(function () {
        atualizarListaQuartosReserva();
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

    var inpAdultos = document.getElementById('reservar-input-adultos');
    var inpCriancas = document.getElementById('reservar-input-criancas');
    var inpTotal = document.getElementById('reservar-input-pessoas-total');
    var adultosMenos = document.getElementById('reservar-adultos-menos');
    var adultosMais = document.getElementById('reservar-adultos-mais');
    var criancasMenos = document.getElementById('reservar-criancas-menos');
    var criancasMais = document.getElementById('reservar-criancas-mais');
    var btnMaisPessoas = document.getElementById('btn-quero-mais-pessoas');
    var btnVoltarAteSeis = document.getElementById('btn-voltar-ate-seis');
    var btnDatas = document.getElementById('btn-step-datas');
    var btnPessoas = document.getElementById('btn-step-pessoas');
    var btnContato = document.getElementById('btn-step-contato');
    var btnFazerReserva = document.getElementById('btn-fazer-reserva');
    var btnSucessoInicio = document.getElementById('reservar-sucesso-inicio');
    var voltar2 = document.getElementById('btn-voltar-pessoas');
    var voltar3 = document.getElementById('btn-voltar-contato');
    var voltar4 = document.getElementById('btn-voltar-confirmacao');
    var inpTelefone = document.getElementById('reservar-telefone');

    if (inpTelefone) {
      inpTelefone.addEventListener('input', function () {
        var pos = inpTelefone.selectionStart;
        var oldLen = inpTelefone.value.length;
        inpTelefone.value = formatTelefoneBr(inpTelefone.value);
        var newLen = inpTelefone.value.length;
        var nextPos = Math.max(0, (pos || 0) + (newLen - oldLen));
        inpTelefone.setSelectionRange(nextPos, nextPos);
      });
      inpTelefone.addEventListener('blur', function () {
        inpTelefone.value = formatTelefoneBr(inpTelefone.value);
      });
    }

    function atualizarUIPessoasCapacidade() {
      var cap = capacidadeQuartoId(state.quartoId);
      var label = document.getElementById('reservar-stepper-label-cap');
      if (label) {
        label.textContent = 'Capacidade do quarto: até ' + cap + ' pessoas (adultos + crianças).';
      }
      if (state.modoGrupo) {
        if (inpAdultos) inpAdultos.setAttribute('max', String(Math.max(1, cap + MAX_PESSOAS_EXTRAS)));
        if (inpCriancas) inpCriancas.setAttribute('max', String(Math.max(0, cap + MAX_PESSOAS_EXTRAS)));
        return;
      }
      var maxA = maxAdultosParaCap(cap, state.criancas);
      var maxC = maxCriancasParaCap(cap, state.adultos);
      if (inpAdultos) inpAdultos.setAttribute('max', String(maxA));
      if (inpCriancas) inpCriancas.setAttribute('max', String(maxC));
      if (adultosMais) adultosMais.disabled = state.adultos >= maxA;
      if (adultosMenos) adultosMenos.disabled = state.adultos <= 1;
      if (criancasMais) criancasMais.disabled = state.criancas >= maxC;
      if (criancasMenos) criancasMenos.disabled = state.criancas <= 0;
    }

    function syncPessoas() {
      var cap = capacidadeQuartoId(state.quartoId);
      if (state.modoGrupo) {
        var raw = inpTotal && inpTotal.value;
        var parsed = parsePessoasExtras(raw);
        if (parsed.valid) state.pessoasAlémCap = parsed.value;
      } else {
        var a = parseInt(inpAdultos && inpAdultos.value, 10);
        var c = parseInt(inpCriancas && inpCriancas.value, 10);
        var clamped = clampHospedesAoCap(cap, a, c);
        a = clamped.adultos;
        c = clamped.criancas;
        if (inpAdultos) inpAdultos.value = String(a);
        if (inpCriancas) inpCriancas.value = String(c);
        state.adultos = a;
        state.criancas = c;
        state.pessoasAlémCap = 0;
      }

      var prN = document.getElementById('reservar-preview-noites');
      var prV = document.getElementById('reservar-preview-valor');
      if (prN) prN.textContent = nights() > 0 ? String(nights()) : '—';
      if (prV) prV.textContent = nights() > 0 && hospedesValidos() ? formatValorReserva() : '—';
      updateMsgAdicional();
      updateSidebar();
      updateBtnContinuarPessoas();
      atualizarUIPessoasCapacidade();
    }

    function bindStepper(menosBtn, maisBtn, input, min, getVal, setVal, getMax) {
      if (menosBtn) {
        menosBtn.addEventListener('click', function () {
          setVal(Math.max(min, getVal() - 1));
          syncPessoas();
        });
      }
      if (maisBtn) {
        maisBtn.addEventListener('click', function () {
          var max = getMax ? getMax() : Infinity;
          setVal(Math.min(max, getVal() + 1));
          syncPessoas();
        });
      }
      if (input) {
        input.addEventListener('change', syncPessoas);
        input.addEventListener('input', syncPessoas);
      }
    }

    bindStepper(
      adultosMenos,
      adultosMais,
      inpAdultos,
      1,
      function () {
        return state.adultos;
      },
      function (v) {
        if (inpAdultos) inpAdultos.value = String(v);
      },
      function () {
        return maxAdultosParaCap(capacidadeQuartoId(state.quartoId), state.criancas);
      }
    );
    bindStepper(
      criancasMenos,
      criancasMais,
      inpCriancas,
      0,
      function () {
        return state.criancas;
      },
      function (v) {
        if (inpCriancas) inpCriancas.value = String(v);
      },
      function () {
        return maxCriancasParaCap(capacidadeQuartoId(state.quartoId), state.adultos);
      }
    );
    if (inpTotal) {
      inpTotal.addEventListener('change', syncPessoas);
      inpTotal.addEventListener('input', syncPessoas);
      inpTotal.addEventListener('blur', function () {
        syncPessoas();
      });
    }

    if (btnMaisPessoas) {
      btnMaisPessoas.addEventListener('click', function () {
        setModoGrupo(true);
      });
    }
    if (btnVoltarAteSeis) {
      btnVoltarAteSeis.addEventListener('click', function () {
        setModoGrupo(false);
      });
    }

    if (btnDatas) {
      btnDatas.addEventListener('click', function () {
        if (btnDatas.disabled) return;
        syncPessoas();
        showStep(2);
      });
    }

    if (btnPessoas) {
      btnPessoas.addEventListener('click', function () {
        if (btnPessoas.disabled) return;
        syncPessoas();
        if (nights() <= 0) return;
        if (!hospedesValidos()) return;
        showStep(3);
      });
    }

    if (btnContato) {
      btnContato.addEventListener('click', function () {
        var nome = document.getElementById('reservar-nome').value.trim();
        var email = document.getElementById('reservar-email').value.trim();
        var tel = document.getElementById('reservar-telefone').value.trim();
        if (!nome || !email || !tel) {
          alert('Preencha nome, e-mail e telefone.');
          return;
        }
        if (!hasNomeESobrenome(nome)) {
          alert('Informe nome e sobrenome.');
          return;
        }
        if (!telefoneComDddValido(tel)) {
          alert('Informe telefone com DDD válido (Brasil).');
          return;
        }
        state.nome = nome;
        state.email = email;
        state.telefone = tel;
        updateSidebar();
        showStep(4);
      });
    }

    if (voltar2) voltar2.addEventListener('click', function () { showStep(1); });
    if (voltar3) voltar3.addEventListener('click', function () { showStep(2); });
    if (voltar4) voltar4.addEventListener('click', function () { showStep(3); });

    if (btnSucessoInicio) {
      btnSucessoInicio.addEventListener('click', function () {
        try {
          sessionStorage.removeItem(CHAVE_POS_WHATS);
        } catch (e) {}
        fecharOverlaySucesso();
      });
    }

    if (btnFazerReserva) {
      btnFazerReserva.textContent = BTN_FINALIZAR_WHATS;
      btnFazerReserva.addEventListener('click', async function () {
        if (!state.checkIn || !state.checkOut || nights() <= 0 || !hospedesValidos()) {
          alert('Complete os dados da reserva antes de continuar.');
          return;
        }
        if (!state.nome || !state.email || !state.telefone) {
          alert('Preencha nome, e-mail e telefone.');
          showStep(3);
          return;
        }
        var entradaIso = toIsoDate(state.checkIn);
        var saidaIso = toIsoDate(state.checkOut);
        btnFazerReserva.disabled = true;
        btnFazerReserva.textContent = 'Abrindo WhatsApp…';

        try {
          await refreshOcupadasMapAsync();
          if (periodoTemConflitoLocal(entradaIso, saidaIso)) {
            alert('Esse período já está reservado ou bloqueado para este quarto. Escolha outras datas.');
            showStep(1);
            return;
          }

          var preco = calcPrecoAtual();
          var codigoLocal = gerarCodigoReservaLocal();
          var reservaWhats = montarReservaParaWhatsApp({ codigo: codigoLocal });
          tentarRegistrarReservaPainel(entradaIso, saidaIso, preco);
          if (!abrirWhatsAppComReserva(reservaWhats)) {
            alert('Não foi possível abrir o WhatsApp. Verifique sua conexão e tente novamente.');
          }
        } catch (errSave) {
          console.error('Reserva:', errSave);
          var fallback = montarReservaParaWhatsApp({ codigo: gerarCodigoReservaLocal() });
          abrirWhatsAppComReserva(fallback);
        } finally {
          btnFazerReserva.disabled = false;
          btnFazerReserva.textContent = BTN_FINALIZAR_WHATS;
        }
      });
    }

    var simples = document.getElementById('reservar-pessoas-simples');
    var grupo = document.getElementById('reservar-pessoas-grupo');
    if (simples) simples.hidden = state.modoGrupo;
    if (grupo) grupo.hidden = !state.modoGrupo;
    syncPessoas();

    function repintarAposReservas() {
      pintarCalendariosEsumario();
    }
    if (window.SystemStore && window.SystemStore.init) {
      window.SystemStore
        .init()
        .then(repintarAposReservas)
        .catch(function (errInit) {
          console.error('Falha ao carregar reservas:', errInit);
          repintarAposReservas();
        });
    }
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
