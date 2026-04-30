(function () {
  var config = window.SystemStore ? window.SystemStore.getConfig() : {
    valorDiaria: 600,
    valorAdicionalPorPessoa: 50,
    pessoasIncluidas: 6
  };
  var MAX_PESSOAS_STEPPER = config.pessoasIncluidas || 6;

  var MESES = [
    'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
    'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'
  ];

  var QUARTOS_RESERVA = [
    {
      id: 'tem-tem',
      titulo: 'TEM-TEM',
      desc:
        'Quarto Duplo com Banheiro Compartilhado. Quarto duplo aconchegante, ideal para casais que buscam conforto e tranquilidade. Cama de casal, vista para o jardim e banheiro compartilhado com chuveiro. Até 2 pessoas · 20 m².',
      preco: 'R$ 150',
      precoLabel: 'Noite',
      img: 'imagem/16.jpg',
      alt: 'Quarto TEM-TEM — Mi Casa Su Casa',
      verQuartoHref: 'quartos.html#quarto-tem-tem'
    },
    {
      id: 'soco',
      titulo: 'soco',
      desc:
        'Quarto Família (4 Camas de Solteiro). Espaçoso, com quatro camas de solteiro, ar-condicionado, cozinha compacta privativa, vista para o jardim e banheiro compartilhado. Até 4 pessoas · 40 m².',
      preco: 'R$ 150',
      precoLabel: 'Noite',
      img: 'imagem/17.jpg',
      alt: 'Quarto soco — Mi Casa Su Casa',
      verQuartoHref: 'quartos.html#quarto-soco'
    },
    {
      id: 'sabia',
      titulo: 'sabiá',
      desc:
        'Quarto Família (1 Cama de Casal + 3 de Solteiro). Amplo espaço, ar-condicionado, cozinha compacta privativa e vista para o jardim. Banheiro compartilhado. Até 5 pessoas · 40 m².',
      preco: 'R$ 150',
      precoLabel: 'Noite',
      img: 'imagem/24.jpg',
      alt: 'Quarto sabiá — Mi Casa Su Casa',
      verQuartoHref: 'quartos.html#quarto-sabia'
    },
    {
      id: 'ararajuba',
      titulo: 'Ararajuba',
      desc:
        'Quarto Duplo. Confortável para casais ou viajantes: cama de casal, vista para o jardim e banheiro compartilhado com chuveiro. Até 2 pessoas · 20 m².',
      preco: 'R$ 150',
      precoLabel: 'Noite',
      img: 'imagem/24.jpg',
      alt: 'Quarto Ararajuba — Mi Casa Su Casa',
      verQuartoHref: 'quartos.html#quarto-ararajuba'
    }
  ];

  var state = {
    entradaMes: null,
    saidaMes: null,
    checkIn: null,
    checkOut: null,
    ocupadas: {},
    quartoId: QUARTOS_RESERVA[0].id,
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
    return QUARTOS_RESERVA[0].id;
  }

  function quartoTituloPorId(id) {
    for (var i = 0; i < QUARTOS_RESERVA.length; i++) {
      if (QUARTOS_RESERVA[i].id === id) return QUARTOS_RESERVA[i].titulo;
    }
    return '—';
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
    if (!window.SystemStore) {
      state.ocupadas = {};
      return;
    }
    if (state.quartoId && window.SystemStore.getOccupiedDateMapForQuarto) {
      state.ocupadas = window.SystemStore.getOccupiedDateMapForQuarto(state.quartoId) || {};
    } else if (window.SystemStore.getOccupiedDateMap) {
      state.ocupadas = window.SystemStore.getOccupiedDateMap() || {};
    } else {
      state.ocupadas = {};
    }
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

  /** Campo total (modo grupo): vazio, 0 ou inválido = inválido. */
  function parsePessoasGrupo(raw) {
    var s = String(raw == null ? '' : raw).trim();
    if (s === '') return { valid: false, value: null };
    var v = parseInt(s, 10);
    if (isNaN(v)) return { valid: false, value: null };
    if (v < 1) return { valid: false, value: null };
    return { valid: true, value: v };
  }

  function getPessoasParaCalculo() {
    if (state.modoGrupo) {
      var inp = document.getElementById('reservar-input-pessoas-total');
      var parsed = parsePessoasGrupo(inp && inp.value);
      return parsed.valid ? parsed.value : null;
    }
    return state.pessoas;
  }

  function totalValor() {
    var n = nights();
    if (n <= 0) return 0;
    var p = getPessoasParaCalculo();
    if (p == null) return 0;
    return n * precoDiariaPorPessoas(p);
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
    if (p == null || p <= 6) {
      el.textContent = '';
      el.hidden = true;
      if (wrap) wrap.hidden = true;
      return;
    }
    var x = p - 6;
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
      btn.disabled = !parsePessoasGrupo(inp && inp.value).valid;
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
      var cur = state.pessoas;
      if (inpT) {
        var start = cur > 6 ? cur : 7;
        inpT.value = String(start);
      }
    } else {
      var inpP = document.getElementById('reservar-input-pessoas');
      if (inpP) inpP.value = String(Math.min(MAX_PESSOAS_STEPPER, Math.max(1, state.pessoas)));
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
    var pCalc = getPessoasParaCalculo();
    if (elP) elP.textContent = pCalc == null ? '—' : String(pCalc);
    if (elT) elT.textContent = nights() > 0 && pCalc != null ? formatMoney(totalValor()) : '—';
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
          if (
            window.SystemStore &&
            window.SystemStore.hasRangeConflictForQuarto &&
            window.SystemStore.hasRangeConflictForQuarto(
              toIsoDate(state.checkIn),
              toIsoDate(picked),
              state.quartoId
            )
          ) {
            alert('Esse período contém datas já reservadas ou bloqueadas para este quarto.');
            return;
          }
          state.checkOut = picked;
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
    var ids = ['painel-etapa-datas', 'painel-etapa-pessoas', 'painel-etapa-contato', 'painel-etapa-pagamento'];
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

    if (window.innerWidth <= 768) {
      var ids = ['painel-etapa-datas', 'painel-etapa-pessoas', 'painel-etapa-contato', 'painel-etapa-pagamento'];
      var target = document.getElementById(ids[step - 1]);
      if (target) {
        window.setTimeout(function () {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 80);
      }
    }
  }

  async function init() {
    var params = new URLSearchParams(window.location.search);
    state.quartoId = resolveQuartoSlug(params.get('quarto'));

    var t = startOfToday();
    state.entradaMes = new Date(t.getFullYear(), t.getMonth(), 1);
    state.saidaMes = new Date(t.getFullYear(), t.getMonth(), 1);
    state.checkIn = null;
    state.checkOut = null;
    state.modoGrupo = false;

    function pintarCalendariosEsumario() {
      refreshOcupadasMap();
      renderCalendar('cal-entrada', 'entrada');
      renderCalendar('cal-saida', 'saida');
      updateSidebar();
      updateContinuarDatas();
    }

    function aplicarQuartoPorIndice(roomIdx) {
      var q = QUARTOS_RESERVA[roomIdx];
      if (!q) return;
      state.quartoId = q.id;
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
      showStep(2);
    }

    initShowcaseQuartosReservar(aplicarQuartoPorIndice);

    if (window.SystemStore && window.SystemStore.init) {
      try {
        await window.SystemStore.init();
      } catch (errInit) {
        console.error('Falha ao carregar reservas no Supabase:', errInit);
      }
      pintarCalendariosEsumario();
    }

    var inpP = document.getElementById('reservar-input-pessoas');
    var inpTotal = document.getElementById('reservar-input-pessoas-total');
    var menos = document.getElementById('reservar-pessoas-menos');
    var mais = document.getElementById('reservar-pessoas-mais');
    var btnMaisPessoas = document.getElementById('btn-quero-mais-pessoas');
    var btnVoltarAteSeis = document.getElementById('btn-voltar-ate-seis');
    var btnDatas = document.getElementById('btn-step-datas');
    var btnPessoas = document.getElementById('btn-step-pessoas');
    var btnContato = document.getElementById('btn-step-contato');
    var btnPagar = document.getElementById('btn-pagar');
    var voltar2 = document.getElementById('btn-voltar-pessoas');
    var voltar3 = document.getElementById('btn-voltar-contato');
    var voltar4 = document.getElementById('btn-voltar-pagamento');
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

    function syncPessoas() {
      var v;
      if (state.modoGrupo) {
        var raw = inpTotal && inpTotal.value;
        var parsed = parsePessoasGrupo(raw);
        if (parsed.valid) {
          state.pessoas = parsed.value;
        }
      } else {
        v = parseInt(inpP && inpP.value, 10);
        if (isNaN(v) || v < 1) v = 1;
        if (v > MAX_PESSOAS_STEPPER) v = MAX_PESSOAS_STEPPER;
        if (inpP) inpP.value = String(v);
        state.pessoas = v;
      }

      var prN = document.getElementById('reservar-preview-noites');
      var prV = document.getElementById('reservar-preview-valor');
      var pCalc = getPessoasParaCalculo();
      if (prN) prN.textContent = nights() > 0 ? String(nights()) : '—';
      if (prV) {
        prV.textContent =
          nights() > 0 && pCalc != null
            ? formatMoney(nights() * precoDiariaPorPessoas(pCalc))
            : '—';
      }
      updateMsgAdicional();
      updateSidebar();
      updateBtnContinuarPessoas();
    }

    if (menos) {
      menos.addEventListener('click', function () {
        if (!inpP) return;
        inpP.value = String(Math.max(1, state.pessoas - 1));
        syncPessoas();
      });
    }
    if (mais) {
      mais.addEventListener('click', function () {
        if (!inpP) return;
        inpP.value = String(Math.min(MAX_PESSOAS_STEPPER, state.pessoas + 1));
        syncPessoas();
      });
    }
    if (inpP) {
      inpP.addEventListener('change', syncPessoas);
      inpP.addEventListener('input', syncPessoas);
    }
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
        if (state.modoGrupo && !parsePessoasGrupo(inpTotal && inpTotal.value).valid) return;
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

    if (btnPagar) {
      btnPagar.addEventListener('click', async function () {
        var pReserva = getPessoasParaCalculo();
        if (!state.checkIn || !state.checkOut || nights() <= 0 || pReserva == null) {
          alert('Complete os dados da reserva antes de pagar.');
          return;
        }
        var entradaIso = toIsoDate(state.checkIn);
        var saidaIso = toIsoDate(state.checkOut);
        var metodoEl = document.querySelector('input[name="reservar-metodo"]:checked');
        var metodo = metodoEl ? metodoEl.value : 'pix';
        if (window.SystemStore && window.SystemStore.listarReservas) {
          try {
            await window.SystemStore.listarReservas();
          } catch (errList) {
            alert('Nao foi possivel validar disponibilidade no banco. Tente novamente.');
            return;
          }
        }
        if (
          window.SystemStore &&
          window.SystemStore.hasRangeConflictForQuarto &&
          window.SystemStore.hasRangeConflictForQuarto(entradaIso, saidaIso, state.quartoId)
        ) {
          alert('Esse período já está reservado ou bloqueado para este quarto. Escolha outras datas.');
          showStep(1);
          return;
        }
        var reservaCriada = null;
        if (window.SystemStore) {
          try {
            reservaCriada = await window.SystemStore.criarReserva({
              nome: state.nome,
              email: state.email,
              telefone: state.telefone,
              pessoas: pReserva,
              dataEntrada: entradaIso,
              dataSaida: saidaIso,
              plataforma: 'site',
              metodoPagamento: metodo,
              quartoId: state.quartoId
            });
          } catch (errSave) {
            alert('Nao foi possivel salvar a reserva no Supabase. Verifique a tabela e as permissoes.');
            return;
          }
        }
        var ov = document.getElementById('reservar-sucesso');
        if (ov) {
          ov.hidden = false;
          document.body.style.overflow = 'hidden';
          var titulo = document.getElementById('reservar-sucesso-titulo');
          var sub = document.querySelector('.reservar-sucesso-sub');
          var metodoEl = document.querySelector('input[name="reservar-metodo"]:checked');
          var metodo = metodoEl ? metodoEl.value : 'pix';
          var metodoLabelMap = {
            pix: 'PIX',
            cartao_credito: 'Cartão de crédito',
            cartao_debito: 'Cartão de débito',
            boleto: 'Boleto',
            transferencia: 'Transferência'
          };
          if (titulo && reservaCriada && reservaCriada.codigo) {
            titulo.textContent = 'Reserva concluída! Código: ' + reservaCriada.codigo;
          }
          if (sub) {
            sub.textContent = 'Método escolhido: ' + (metodoLabelMap[metodo] || 'PIX') + ' (simulação). Em alguns segundos você voltará ao início do site.';
          }
        }
        window.setTimeout(function () {
          window.location.href = 'index.html';
        }, 7000);
      });
    }

    var simples = document.getElementById('reservar-pessoas-simples');
    var grupo = document.getElementById('reservar-pessoas-grupo');
    if (simples) simples.hidden = state.modoGrupo;
    if (grupo) grupo.hidden = !state.modoGrupo;
    syncPessoas();
  }

  function initShowcaseQuartosReservar(onSelecionarQuarto) {
    var root = document.querySelector('[data-reservar-quarto-showcase]');
    if (!root || typeof onSelecionarQuarto !== 'function') return;

    var QUARTOS = QUARTOS_RESERVA;
    var N = QUARTOS.length;
    var DUR_SLIDE_MS = 900;
    var richMotion = true;
    try {
      richMotion = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (eM) {}

    function aplicarSlides(slides, centerIdx) {
      for (var i = 0; i < slides.length; i++) {
        slides[i].classList.remove('pos-esquerda', 'pos-centro', 'pos-direita');
        if (i === centerIdx) slides[i].classList.add('pos-centro');
        else if (i === (centerIdx + 1) % 3) slides[i].classList.add('pos-direita');
        else slides[i].classList.add('pos-esquerda');
      }
    }

    function indiceQuartoNoSlide(centerIdx, slideIdx, roomIdx) {
      var off = (slideIdx - centerIdx + 3) % 3;
      return (roomIdx + off) % N;
    }

    function atualizarImagens(slides, centerIdx, roomIdx) {
      for (var i = 0; i < slides.length; i++) {
        var qi = indiceQuartoNoSlide(centerIdx, i, roomIdx);
        var q = QUARTOS[qi];
        var img = slides[i].querySelector('img');
        if (img) {
          img.src = q.img;
          img.alt = q.alt;
        }
      }
    }

    function preencherCopy(copyInner, roomIdx) {
      var q = QUARTOS[roomIdx];
      if (!q || !copyInner) return;
      var tit = copyInner.querySelector('.quartos-showcase-titulo');
      var desc = copyInner.querySelector('.quartos-showcase-desc');
      var precoVal = copyInner.querySelector('.quartos-showcase-preco-valor');
      if (tit) tit.textContent = q.titulo;
      if (desc) desc.textContent = q.desc;
      if (precoVal) precoVal.textContent = q.preco;
      var lbl = copyInner.querySelector('.quartos-showcase-preco-label');
      if (lbl) lbl.textContent = q.precoLabel || 'Noite';
      var a = copyInner.querySelector('.quartos-showcase-btn');
      if (a) {
        a.href = q.verQuartoHref || 'quartos.html';
        a.textContent = 'Ver quarto';
      }
    }

    function animarTexto(copyInner, novoRoomIdx) {
      if (!richMotion) {
        preencherCopy(copyInner, novoRoomIdx);
        return;
      }
      copyInner.classList.add('quartos-copy--saida');
      window.setTimeout(function () {
        preencherCopy(copyInner, novoRoomIdx);
        copyInner.classList.remove('quartos-copy--saida');
        copyInner.classList.add('quartos-copy--entrada-pre');
        void copyInner.offsetWidth;
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            copyInner.classList.remove('quartos-copy--entrada-pre');
            copyInner.classList.add('quartos-copy--entrada');
            window.setTimeout(function () {
              copyInner.classList.remove('quartos-copy--entrada');
            }, 580);
          });
        });
      }, 340);
    }

    var slides = root.querySelectorAll('.quartos-3d-slide');
    if (slides.length !== 3) return;
    var copyInner = root.querySelector('.quartos-showcase-copy-inner');
    var prevBtn = root.querySelector('.quartos-showcase-nav--prev');
    var nextBtn = root.querySelector('.quartos-showcase-nav--next');
    if (!copyInner || !prevBtn || !nextBtn) return;

    var roomIdx = 0;
    for (var ri = 0; ri < QUARTOS.length; ri++) {
      if (QUARTOS[ri].id === state.quartoId) {
        roomIdx = ri;
        break;
      }
    }

    var centerSlide = 0;
    var animando = false;

    function setBusy(b) {
      if (b) {
        root.setAttribute('aria-busy', 'true');
        prevBtn.disabled = true;
        nextBtn.disabled = true;
      } else {
        root.removeAttribute('aria-busy');
        prevBtn.disabled = false;
        nextBtn.disabled = false;
      }
    }

    function ir(dir) {
      if (animando || N < 2) return;
      animando = true;
      setBusy(true);

      var novoR = dir === 1 ? (roomIdx + 1) % N : (roomIdx + N - 1) % N;
      var novoC = dir === 1 ? (centerSlide + 1) % 3 : (centerSlide + 2) % 3;

      if (dir === 1) {
        var slidePatch = (centerSlide + 2) % 3;
        var qAlvo = QUARTOS[(roomIdx + 2) % N];
        var imgP = slides[slidePatch].querySelector('img');
        if (imgP) {
          imgP.src = qAlvo.img;
          imgP.alt = qAlvo.alt;
        }
      }

      roomIdx = novoR;
      centerSlide = novoC;
      aplicarSlides(slides, centerSlide);
      animarTexto(copyInner, novoR);

      window.setTimeout(function () {
        atualizarImagens(slides, centerSlide, roomIdx);
        animando = false;
        setBusy(false);
        onSelecionarQuarto(roomIdx);
      }, DUR_SLIDE_MS);
    }

    atualizarImagens(slides, centerSlide, roomIdx);
    aplicarSlides(slides, centerSlide);
    preencherCopy(copyInner, roomIdx);

    prevBtn.addEventListener('click', function () {
      ir(-1);
    });
    nextBtn.addEventListener('click', function () {
      ir(1);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      init();
    });
  } else {
    init();
  }
})();
