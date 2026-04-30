(function () {
  var state = {
    tab: 'faturamento',
    calendarMonth: new Date().getMonth(),
    calendarYear: new Date().getFullYear(),
    historyQuery: '',
    fichaView: 'cliente',
    fichaQuery: '',
    fichaStatus: 'todos',
    periodo: 'hoje',
    periodoMenuOpen: false
  };
  var deferredInstallPrompt = null;
  var installPromptListener = null;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function money(v) {
    return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function fmtDate(iso) {
    var d = SystemStore.parseIsoDate(iso);
    return d ? d.toLocaleDateString('pt-BR') : '—';
  }

  function fmtDateTime(iso) {
    var d = iso ? new Date(iso) : null;
    return d && !isNaN(d.getTime())
      ? d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
      : '—';
  }

  function fmtTimeBrasilia(iso) {
    var d = iso ? new Date(iso) : null;
    return d && !isNaN(d.getTime())
      ? d.toLocaleTimeString('pt-BR', {
          timeZone: 'America/Sao_Paulo',
          hour: '2-digit',
          minute: '2-digit'
        })
      : '—';
  }

  function firstNameOnly(nome) {
    var parts = String(nome || '').trim().split(/\s+/).filter(Boolean);
    return parts.length ? parts[0] : '';
  }

  function getReservasAtivas() {
    return SystemStore.getReservas().filter(function (r) {
      return r.status !== 'cancelada';
    });
  }

  function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function filterReservasByPeriodo(list, periodo) {
    var now = new Date();
    var todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    var currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    var prevMonthStart = new Date(currentMonthStart.getFullYear(), currentMonthStart.getMonth() - 1, 1);
    var twoMonthsAgoStart = new Date(currentMonthStart.getFullYear(), currentMonthStart.getMonth() - 2, 1);
    var threeMonthsAgoStart = new Date(currentMonthStart.getFullYear(), currentMonthStart.getMonth() - 3, 1);

    return (list || []).filter(function (r) {
      var d = r && r.criadoEm ? new Date(r.criadoEm) : null;
      if (!d || isNaN(d.getTime())) return false;
      var t = d.getTime();
      if (periodo === 'hoje') {
        return t >= todayStart.getTime() && t < tomorrowStart.getTime();
      }
      if (periodo === '2_meses_atras') {
        return t >= twoMonthsAgoStart.getTime() && t < prevMonthStart.getTime();
      }
      if (periodo === '3_meses_atras') {
        return t >= threeMonthsAgoStart.getTime() && t < twoMonthsAgoStart.getTime();
      }
      return t >= prevMonthStart.getTime() && t < currentMonthStart.getTime();
    });
  }

  function setActiveTab(tab) {
    state.tab = tab;
    document.querySelectorAll('.sys-nav-btn').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tab);
    });
    document.querySelectorAll('.sys-tab').forEach(function (sec) {
      sec.classList.toggle('active', sec.id === 'tab-' + tab);
    });
    if (window.innerWidth <= 980) {
      var shell = document.querySelector('.sys-shell');
      var toggle = document.getElementById('sys-mobile-toggle');
      if (shell) shell.classList.remove('menu-open');
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
    }
  }

  function renderFaturamento() {
    var reservasBase = getReservasAtivas();
    var reservas = filterReservasByPeriodo(reservasBase, state.periodo);
    var f = SystemStore.faturamentoPorPlataforma(reservas);
    var qtdReservas = reservas.length;
    var meiosPagamento = renderMeiosPagamento(reservas);
    var graficoReservas = renderGraficoReservasDia(reservas);
    var el = document.getElementById('tab-faturamento');
    var periodoLabelMap = {
      hoje: 'Hoje',
      mes_passado: 'Mês passado',
      '2_meses_atras': '2 meses atrás',
      '3_meses_atras': '3 meses atrás'
    };
    var periodoLabel = periodoLabelMap[state.periodo] || 'Hoje';
    el.innerHTML =
      '<div class="sys-topbar">' +
      '<div class="sys-topbar-title-wrap"><h2 class="sys-topbar-title">Dashboard</h2></div>' +
      '<div class="sys-topbar-controls">' +
      '<label class="sys-topbar-field"><span>Quantidade de reservas</span><input type="text" readonly value="' +
      esc(String(qtdReservas)) +
      '" /></label>' +
      '<div class="sys-topbar-field sys-topbar-field--periodo"><span>Período</span>' +
      '<div class="sys-periodo' +
      (state.periodoMenuOpen ? ' open' : '') +
      '">' +
      '<button type="button" class="sys-periodo-btn" data-periodo-toggle="true" aria-expanded="' +
      (state.periodoMenuOpen ? 'true' : 'false') +
      '">' +
      '<span class="sys-periodo-label">' +
      esc(periodoLabel) +
      '</span>' +
      '<span class="sys-periodo-caret" aria-hidden="true">▾</span>' +
      '</button>' +
      '<div class="sys-periodo-menu"' +
      (state.periodoMenuOpen ? '' : ' hidden') +
      '>' +
      '<button type="button" class="sys-periodo-item' +
      (state.periodo === 'hoje' ? ' active' : '') +
      '" data-periodo-value="hoje">Hoje</button>' +
      '<button type="button" class="sys-periodo-item' +
      (state.periodo === 'mes_passado' ? ' active' : '') +
      '" data-periodo-value="mes_passado">Mês passado</button>' +
      '<button type="button" class="sys-periodo-item' +
      (state.periodo === '2_meses_atras' ? ' active' : '') +
      '" data-periodo-value="2_meses_atras">2 meses atrás</button>' +
      '<button type="button" class="sys-periodo-item' +
      (state.periodo === '3_meses_atras' ? ' active' : '') +
      '" data-periodo-value="3_meses_atras">3 meses atrás</button>' +
      '</div></div></div>' +
      '</div>' +
      '</div>' +
      '<div class="sys-header-card sys-header-split">' +
      '<div class="sys-header-col"><div class="sys-metric-main">' +
      esc(money(f.site)) +
      '</div><div class="sys-metric-sub">Site</div></div>' +
      '<div class="sys-header-divider"></div>' +
      '<div class="sys-header-col"><div class="sys-metric-main">' +
      esc(money(f.total)) +
      '</div><div class="sys-metric-sub">Total geral</div></div>' +
      '</div>' +
      '<div class="sys-grid-4 sys-grid-3">' +
      cardPlataforma('Booking', f.booking) +
      cardPlataforma('Airbnb', f.airbnb) +
      cardPlataforma('VRBO', f.vrbo) +
      '</div>' +
      '<div style="margin-top:3.6rem">' +
      meiosPagamento +
      '</div>' +
      '<div style="margin-top:1.2rem">' +
      '<div class="sys-only-desktop">' + graficoReservas + '</div>' +
      '</div>';
    bindReservasChartTooltip();
  }

  function cardPlataforma(label, value) {
    return (
      '<article class="sys-card"><div class="sys-metric-main">' +
      esc(money(value)) +
      '</div><div class="sys-platform small">' +
      esc(label) +
      '</div></article>'
    );
  }

  function renderMeiosPagamento(reservas) {
    var methods = [
      { key: 'pix', icon: '◈', label: 'Pix', value: 0 },
      { key: 'boleto', icon: '▥', label: 'Boleto', value: 0 },
      { key: 'cartao_credito', icon: '▭', label: 'Cartão de crédito', value: 0 },
      { key: 'cartao_debito', icon: '▭', label: 'Cartão de débito', value: 0 },
      { key: 'transferencia', icon: '⇄', label: 'Transferência', value: 0 }
    ];
    var byKey = {};
    methods.forEach(function (m) {
      byKey[m.key] = m;
    });
    (reservas || []).forEach(function (r) {
      var key = String((r && r.metodoPagamento) || 'pix').toLowerCase();
      var method = byKey[key] || byKey.pix;
      method.value += Number((r && r.valorTotal) || 0);
    });
    var totalGeral = methods.reduce(function (acc, item) {
      return acc + (Number(item.value) || 0);
    }, 0);
    var lines = methods
      .map(function (item) {
        var conv = totalGeral > 0 ? ((item.value / totalGeral) * 100).toFixed(0) : '0';
        return (
          '<div class="sys-pay-row">' +
          '<div class="sys-pay-cell sys-pay-method"><span class="sys-pay-icon">' +
          esc(item.icon) +
          '</span><span>' +
          esc(item.label) +
          '</span></div>' +
          '<div class="sys-pay-cell">' +
          esc(conv) +
          '%</div>' +
          '<div class="sys-pay-cell">' +
          esc(money(item.value)) +
          '</div>' +
          '</div>'
        );
      })
      .join('');
    return (
      '<article class="sys-card sys-payment-card">' +
      '<div class="sys-pay-head">' +
      '<div>Meios de Pagamento</div>' +
      '<div>Conversão</div>' +
      '<div>Valor</div>' +
      '</div>' +
      '<div class="sys-pay-body">' +
      lines +
      '</div>' +
      '</article>'
    );
  }

  function renderGraficoReservasDia(reservas) {
    var now = new Date();
    var year = now.getFullYear();
    var month = now.getMonth();
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    var counts = new Array(daysInMonth).fill(0);

    (reservas || []).forEach(function (r) {
      var criado = r && r.criadoEm ? new Date(r.criadoEm) : null;
      if (!criado || isNaN(criado.getTime())) return;
      if (criado.getFullYear() !== year || criado.getMonth() !== month) return;
      counts[criado.getDate() - 1] += 1;
    });

    var maxCount = counts.reduce(function (acc, n) {
      return n > acc ? n : acc;
    }, 0);
    var axisMax = Math.max(2, maxCount);

    var width = 1080;
    var height = 260;
    var left = 0;
    var right = 0;
    var top = 14;
    var bottom = 36;
    var plotW = width - left - right;
    var plotH = height - top - bottom;

    var gridLines = '';
    for (var i = 0; i <= 5; i++) {
      var gy = top + (plotH * i) / 5;
      gridLines +=
        '<line x1="' +
        left +
        '" y1="' +
        gy.toFixed(2) +
        '" x2="' +
        (left + plotW) +
        '" y2="' +
        gy.toFixed(2) +
        '" class="sys-chart-grid-line" />';
    }

    var pointsArr = counts
      .map(function (value, idx) {
        var x = left + (idx * plotW) / Math.max(1, counts.length - 1);
        var y = top + plotH - (value / axisMax) * plotH;
        return { x: x, y: y, day: idx + 1, count: value };
      })
    ;

    var points = pointsArr
      .map(function (p) {
        return p.x.toFixed(2) + ',' + p.y.toFixed(2);
      })
      .join(' ');

    var smoothPath = '';
    if (pointsArr.length) {
      smoothPath = 'M ' + pointsArr[0].x.toFixed(2) + ' ' + pointsArr[0].y.toFixed(2);
      for (var s = 1; s < pointsArr.length; s++) {
        var prev = pointsArr[s - 1];
        var curr = pointsArr[s];
        var cx = ((prev.x + curr.x) / 2).toFixed(2);
        smoothPath += ' Q ' + prev.x.toFixed(2) + ' ' + prev.y.toFixed(2) + ', ' + cx + ' ' + ((prev.y + curr.y) / 2).toFixed(2);
        smoothPath += ' T ' + curr.x.toFixed(2) + ' ' + curr.y.toFixed(2);
      }
    }

    var labels = pointsArr
      .map(function (p) {
        return '<span class="sys-chart-x-item">' + String(p.day).padStart(2, '0') + '</span>';
      })
      .join('');

    var hitAreas = pointsArr
      .map(function (p) {
        return (
          '<rect class="sys-chart-hit" x="' +
          (p.x - 9).toFixed(2) +
          '" y="' +
          top.toFixed(2) +
          '" width="18" height="' +
          plotH.toFixed(2) +
          '" data-day="' +
          p.day +
          '" data-count="' +
          p.count +
          '" data-x="' +
          p.x.toFixed(2) +
          '" data-y="' +
          p.y.toFixed(2) +
          '" />'
        );
      })
      .join('');

    return (
      '<article class="sys-card sys-reservas-chart-card">' +
      '<div class="sys-chart-head">Reservas feitas por dia</div>' +
      '<div class="sys-chart-wrap">' +
      '<svg viewBox="0 0 ' +
      width +
      ' ' +
      height +
      '" class="sys-chart-svg" role="img" aria-label="Grafico de reservas por dia">' +
      '<g>' +
      gridLines +
      (smoothPath
        ? '<path d="' + smoothPath + '" class="sys-chart-line" />'
        : '<polyline points="' + points + '" class="sys-chart-line" />') +
      '<line class="sys-chart-crosshair" x1="' +
      left +
      '" y1="' +
      top +
      '" x2="' +
      left +
      '" y2="' +
      (top + plotH) +
      '" hidden />' +
      '<circle class="sys-chart-dot" cx="' +
      left +
      '" cy="' +
      (top + plotH) +
      '" r="4.5" hidden />' +
      hitAreas +
      '</g></svg></div>' +
      '<div class="sys-chart-x" style="--chart-days:' +
      daysInMonth +
      '">' +
      labels +
      '</div>' +
      '<div class="sys-chart-tooltip" hidden></div>' +
      '</article>'
    );
  }

  function bindReservasChartTooltip() {
    document.querySelectorAll('.sys-reservas-chart-card').forEach(function (card) {
      var tooltip = card.querySelector('.sys-chart-tooltip');
      var wrap = card.querySelector('.sys-chart-wrap');
      var crosshair = card.querySelector('.sys-chart-crosshair');
      var dot = card.querySelector('.sys-chart-dot');
      if (!tooltip || !wrap) return;
      var hits = card.querySelectorAll('.sys-chart-hit');
      function hideAll() {
        tooltip.hidden = true;
        if (crosshair) crosshair.setAttribute('hidden', 'hidden');
        if (dot) dot.setAttribute('hidden', 'hidden');
      }
      hits.forEach(function (hit) {
        function show() {
          var day = hit.getAttribute('data-day');
          var count = hit.getAttribute('data-count');
          var x = Number(hit.getAttribute('data-x') || 0);
          var y = Number(hit.getAttribute('data-y') || 0);
          tooltip.textContent = String(day).padStart(2, '0') + ' - ' + count + ' reserva' + (count === '1' ? '' : 's');
          tooltip.hidden = false;
          var rect = wrap.getBoundingClientRect();
          var tipX = Math.max(8, Math.min(rect.width - 140, x - 24));
          var tipY = Math.max(8, y - 48);
          tooltip.style.left = tipX + 'px';
          tooltip.style.top = tipY + 'px';
          if (crosshair) {
            crosshair.setAttribute('x1', String(x));
            crosshair.setAttribute('x2', String(x));
            crosshair.removeAttribute('hidden');
          }
          if (dot) {
            dot.setAttribute('cx', String(x));
            dot.setAttribute('cy', String(y));
            dot.removeAttribute('hidden');
          }
        }
        hit.addEventListener('mouseenter', show);
        hit.addEventListener('mousemove', show);
        hit.addEventListener('mouseleave', hideAll);
      });
      wrap.addEventListener('mouseleave', hideAll);
    });
  }

  function renderRows(list, withOpen) {
    if (!list.length) return '<p class="sys-empty">Nenhuma reserva encontrada.</p>';
    var html = '<div class="sys-table-wrap">';
    html += '<div class="sys-row header"><div>nome</div><div>numero</div><div>codigo</div><div>app</div><div>Total</div>';
    html += withOpen ? '<div></div></div>' : '<div></div></div>';
    list.forEach(function (r) {
      html += '<div class="sys-row">';
      html += '<div class="sys-cell">' + esc(r.nome) + '</div>';
      html += '<div class="sys-cell">' + esc(r.telefone) + '</div>';
      html += '<div class="sys-cell">' + esc(r.codigo) + '</div>';
      html += '<div class="sys-cell">' + esc((r.plataforma || 'site').toUpperCase()) + '</div>';
      html += '<div class="sys-cell">' + esc(money(r.valorTotal)) + '</div>';
      if (withOpen) {
        html += '<div><button class="sys-btn" data-open="' + esc(r.id) + '">Abrir</button></div>';
      } else {
        html += '<div></div>';
      }
      html += '</div>';
    });
    html += '</div>';
    return html;
  }

  function renderFicha() {
    var reservas = SystemStore.getReservas();
    var hoje = new Date();
    var hojeIso = SystemStore.toIsoDate(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()));
    var listBase = reservas.filter(function (r) {
      var status = (r.status || '').toLowerCase();
      var dataSaida = r.dataSaida || '';
      var finalizadaPorData = dataSaida && dataSaida < hojeIso;
      if (state.fichaView === 'historico') {
        return status === 'cancelada' || finalizadaPorData;
      }
      return status !== 'cancelada' && !finalizadaPorData;
    });
    var list = SystemStore.searchReservas(listBase, state.fichaQuery).filter(function (r) {
      if (state.fichaStatus === 'todos') return true;
      var status = (r.status || '').toLowerCase();
      if (state.fichaStatus === 'cancelada') return status === 'cancelada';
      if (state.fichaStatus === 'ativa') return status !== 'cancelada';
      return true;
    });
    var el = document.getElementById('tab-ficha');
    var rows = list.length
      ? list
          .slice(0, 60)
          .map(function (r) {
            var statusTxt = (r.status || '').toLowerCase() === 'cancelada' ? 'Cancelada' : 'Ativa';
            return (
              '<div class="sys-ficha-row">' +
              '<div class="sys-ficha-col-nome">' +
              '<span class="sys-nome-desktop">' + esc(r.nome || 'Sem nome') + '</span>' +
              '<span class="sys-nome-mobile">' + esc(firstNameOnly(r.nome || 'Sem nome')) + '</span>' +
              '</div>' +
              '<div class="sys-ficha-col-valor">' +
              esc(money(r.valorTotal)) +
              '</div>' +
              '<div class="sys-ficha-col-status"><span class="sys-ficha-status-pill">' +
              esc(statusTxt) +
              '</span><button class="sys-btn sys-ficha-open" data-open="' +
              esc(r.id) +
              '">Abrir</button></div>' +
              '</div>'
            );
          })
          .join('')
      : '<div class="sys-ficha-empty">Nenhuma ficha encontrada.</div>';
    var cards = list.length
      ? '<div class="sys-history-cards">' +
        list
          .slice(0, 60)
          .map(function (r) {
            return (
              '<article class="sys-h-card">' +
              '<div class="sys-h-head"><span>' +
              esc(r.codigo || 'SEM-CODIGO') +
              '</span><span>' +
              esc(fmtTimeBrasilia(r.criadoEm)) +
              '</span></div>' +
              '<div class="sys-h-pill">Nome: ' +
              esc(r.nome) +
              '</div>' +
              '<div class="sys-h-pill">Gmail: ' +
              esc(r.email) +
              '</div>' +
              '<div class="sys-h-pill">Numero: ' +
              esc(r.telefone) +
              '</div>' +
              '<div style="margin-top:0.5rem;text-align:right"><button class="sys-btn" data-open="' +
              esc(r.id) +
              '">Abrir</button></div>' +
              '</article>'
            );
          })
          .join('') +
        '</div>'
      : '<div class="sys-ficha-empty">Nenhuma ficha encontrada.</div>';
    el.innerHTML =
      '<div class="sys-ficha-board">' +
      '<div class="sys-ficha-top-tabs">' +
      '<button class="sys-ficha-tab' +
      (state.fichaView === 'cliente' ? ' active' : '') +
      '" data-ficha-view="cliente">Ficha de cliente</button>' +
      '<button class="sys-ficha-tab' +
      (state.fichaView === 'historico' ? ' active' : '') +
      '" data-ficha-view="historico">Historico de ficha</button>' +
      '</div>' +
      '<div class="sys-ficha-filters">' +
      '<input id="ficha-search" class="sys-ficha-search" placeholder="Pesquisar" value="' +
      esc(state.fichaQuery) +
      '" />' +
      (state.fichaView === 'historico'
        ? '<label class="sys-ficha-status-wrap"><span>Status</span><select id="ficha-status">' +
          '<option value="todos"' +
          (state.fichaStatus === 'todos' ? ' selected' : '') +
          '>Todos</option>' +
          '<option value="ativa"' +
          (state.fichaStatus === 'ativa' ? ' selected' : '') +
          '>Ativa</option>' +
          '<option value="cancelada"' +
          (state.fichaStatus === 'cancelada' ? ' selected' : '') +
          '>Cancelada</option>' +
          '</select></label>'
        : '') +
      '</div>' +
      (state.fichaView === 'historico'
        ? '<div class="sys-ficha-table-head"><div>Nome</div><div>Preco</div><div>Status</div></div>' +
          '<div class="sys-ficha-table-body">' +
          rows +
          '</div>'
        : cards) +
      '</div>';
  }

  function renderHistorico() {
    var reservas = SystemStore.getReservas();
    var found = SystemStore.searchReservas(reservas, state.historyQuery);
    var historicoRows = renderRows(found, true);
    var el = document.getElementById('tab-historico');
    if (!el) return;
    el.innerHTML =
      '<input id="history-search" class="sys-search" placeholder="Busca por nome, código, gmail ou número" value="' +
      esc(state.historyQuery) +
      '" />' +
      historicoRows +
      '';
  }

  function renderCalendario() {
    var el = document.getElementById('tab-calendario');
    var months = [
      'JANEIRO', 'FEVEREIRO', 'MARCO', 'ABRIL', 'MAIO', 'JUNHO',
      'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'
    ];
    var occupied = SystemStore.getOccupiedDateMap();
    var firstRef = new Date(state.calendarYear, state.calendarMonth, 1);
    var secondRef = new Date(state.calendarYear, state.calendarMonth, 1);
    var html = '<h2 class="sys-section-title">calendario</h2>';
    html += '<div class="sys-calendar-toolbar">';
    html += '<select id="cal-month" class="sys-select">';
    for (var m = 0; m < 12; m++) {
      html += '<option value="' + m + '"' + (m === state.calendarMonth ? ' selected' : '') + '>' + months[m] + '</option>';
    }
    html += '</select>';
    html += '<select id="cal-year" class="sys-select">';
    for (var y = state.calendarYear - 2; y <= state.calendarYear + 2; y++) {
      html += '<option value="' + y + '"' + (y === state.calendarYear ? ' selected' : '') + '>' + y + '</option>';
    }
    html += '</select></div>';
    html += '<div class="sys-cal-dupla">';
    html += renderCalendarioReservaLike('ENTRADA', firstRef.getFullYear(), firstRef.getMonth(), months, occupied);
    html += renderCalendarioReservaLike('SAIDA', secondRef.getFullYear(), secondRef.getMonth(), months, occupied);
    html += '</div>';
    html += '<div style="margin-top:1.4rem">' + renderConfigSection() + '</div>';
    el.innerHTML = html;
  }

  function renderCalendarioReservaLike(label, y, m, months, occupied) {
    var firstDow = new Date(y, m, 1).getDay();
    var dim = new Date(y, m + 1, 0).getDate();
    var today = new Date();
    var todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    var html = '';
    html += '<article class="sys-rv-card">';
    html += '<p class="sys-rv-legenda">' + label + '</p>';
    html += '<div class="sys-rv-mount">';
    html += '<div class="sys-rv-nav">';
    html += '<button type="button" class="sys-rv-nav-btn" data-cal-nav="-1" aria-label="Mes anterior">‹</button>';
    html += '<div class="sys-rv-nav-title"><span class="sys-rv-year">' + y + '</span><strong class="sys-rv-month">' + months[m] + '</strong></div>';
    html += '<button type="button" class="sys-rv-nav-btn" data-cal-nav="1" aria-label="Proximo mes">›</button>';
    html += '</div>';
    html += '<div class="sys-rv-week">DOM SEG TER QUA QUI SEX SAB</div>';
    html += '<div class="sys-rv-grid">';
    for (var i = 0; i < firstDow; i++) html += '<span class="sys-rv-cell sys-rv-empty"></span>';
    for (var d = 1; d <= dim; d++) {
      var dt = new Date(y, m, d);
      var iso = [y, String(m + 1).padStart(2, '0'), String(d).padStart(2, '0')].join('-');
      var kind = occupied[iso] || '';
      var cls = 'sys-rv-cell';
      if (dt < todayStart) cls += ' sys-rv-past';
      if (kind === 'reserva') cls += ' sys-rv-ocupado';
      if (kind === 'bloqueio') cls += ' sys-rv-bloqueado';
      html += '<span class="' + cls + '">' + d + '</span>';
    }
    html += '</div></div></article>';
    return html;
  }

  function renderConfigSection() {
    var cfg = SystemStore.getConfig();
    var bloqueios = SystemStore.getBloqueios();
    return (
      '<div class="sys-columns-2">' +
      '<article class="sys-card"><h3>fechamento de datas</h3><form id="form-bloqueio" class="sys-form">' +
      '<input class="sys-input" type="date" id="bloqueio-inicio" required />' +
      '<input class="sys-input" type="date" id="bloqueio-fim" required />' +
      '<input class="sys-input" type="text" id="bloqueio-motivo" placeholder="Motivo (opcional)" />' +
      '<button class="sys-btn" type="submit">Salvar bloqueio</button></form>' +
      (bloqueios.length
        ? '<div style="margin-top:0.8rem">' +
          bloqueios
            .map(function (b) {
              return (
                '<div class="sys-row" style="grid-template-columns:1fr 1fr 120px">' +
                '<div>' +
                esc(fmtDate(b.dataInicio) + ' até ' + fmtDate(b.dataFim)) +
                '</div><div>' +
                esc(b.motivo || '-') +
                '</div><div><button class="sys-btn" data-rm-bloq="' +
                esc(b.id) +
                '">remover</button></div></div>'
              );
            })
            .join('') +
          '</div>'
        : '<p class="sys-help">Sem datas bloqueadas.</p>') +
      '</article>' +
      '<article class="sys-card"><h3>Valores</h3><form id="form-config" class="sys-form">' +
      '<label>Valor diária</label><input class="sys-input" id="cfg-diaria" type="number" min="1" step="0.01" value="' +
      esc(cfg.valorDiaria) +
      '" />' +
      '<label>Valor adicional por pessoa</label><input class="sys-input" id="cfg-adicional" type="number" min="0" step="0.01" value="' +
      esc(cfg.valorAdicionalPorPessoa) +
      '" />' +
      '<button class="sys-btn" type="submit">Salvar valores</button>' +
      '</form>' +
      '<p class="sys-help">Esses valores impactam novas reservas no site.</p>' +
      '</article></div>'
    );
  }

  function bindEvents() {
    var mobileToggle = document.getElementById('sys-mobile-toggle');
    var logoutBtn = document.getElementById('btn-logout');
    var installBtn = document.getElementById('btn-instalar-app');
    document.querySelectorAll('.sys-nav-btn[data-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setActiveTab(btn.getAttribute('data-tab'));
      });
    });

    if (mobileToggle) {
      mobileToggle.addEventListener('click', function () {
        var shell = document.querySelector('.sys-shell');
        if (!shell) return;
        var open = shell.classList.toggle('menu-open');
        mobileToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    }

    document.body.addEventListener('click', function (ev) {
      var view = ev.target.getAttribute('data-ficha-view');
      if (view) {
        state.fichaView = view;
        renderFicha();
      }
    });

    if (logoutBtn) {
      logoutBtn.addEventListener('click', async function () {
        try {
          await window.Auth.signOut();
        } finally {
          try {
            if ('serviceWorker' in navigator) {
              var regs = await navigator.serviceWorker.getRegistrations();
              regs.forEach(function (r) {
                r.unregister();
              });
            }
          } catch (e) {}
          deferredInstallPrompt = null;
          if (installPromptListener) {
            window.removeEventListener('beforeinstallprompt', installPromptListener);
            installPromptListener = null;
          }
          if (installBtn) installBtn.hidden = true;
          window.location.href = 'login.html';
        }
      });
    }

    if (installBtn) {
      installBtn.addEventListener('click', async function () {
        if (!deferredInstallPrompt) {
          alert('Instalacao indisponivel neste navegador.');
          return;
        }
        deferredInstallPrompt.prompt();
        await deferredInstallPrompt.userChoice;
        deferredInstallPrompt = null;
        installBtn.hidden = true;
      });
    }

    document.body.addEventListener('click', function (ev) {
      var periodoToggle = ev.target.closest && ev.target.closest('[data-periodo-toggle="true"]');
      if (periodoToggle) {
        state.periodoMenuOpen = !state.periodoMenuOpen;
        renderFaturamento();
        return;
      }
      var periodoValue = ev.target.getAttribute('data-periodo-value');
      if (periodoValue) {
        state.periodo = periodoValue;
        state.periodoMenuOpen = false;
        renderFaturamento();
        return;
      }
      var isInPeriodo = ev.target.closest && ev.target.closest('.sys-periodo');
      if (!isInPeriodo && state.periodoMenuOpen) {
        state.periodoMenuOpen = false;
        renderFaturamento();
        return;
      }
      var calNav = ev.target.getAttribute('data-cal-nav');
      if (calNav) {
        var step = Number(calNav);
        if (!isNaN(step) && step !== 0) {
          var ref = new Date(state.calendarYear, state.calendarMonth + step, 1);
          state.calendarYear = ref.getFullYear();
          state.calendarMonth = ref.getMonth();
          renderCalendario();
        }
        return;
      }
      var openId = ev.target.getAttribute('data-open');
      if (openId) {
        openModal(openId);
        return;
      }
      var rm = ev.target.getAttribute('data-rm-bloq');
      if (rm) {
        SystemStore.removeBloqueio(rm);
        renderAll();
        return;
      }
      var cancelId = ev.target.getAttribute('data-cancel-reserva');
      if (cancelId) {
        var ok = window.confirm('Deseja realmente cancelar esta reserva?');
        if (!ok) return;
        SystemStore.cancelarReserva(cancelId)
          .then(function () {
            closeModal();
            renderAll();
          })
          .catch(function () {
            alert('Nao foi possivel cancelar no Supabase.');
          });
        return;
      }
      if (ev.target.getAttribute('data-close-modal') === 'true') {
        closeModal();
      }
    });

    document.body.addEventListener('input', function (ev) {
      if (ev.target.id === 'history-search') {
        state.historyQuery = ev.target.value;
        if (state.tab === 'ficha') renderFicha();
      } else if (ev.target.id === 'ficha-search') {
        var cursorPos = ev.target.selectionStart;
        state.fichaQuery = ev.target.value;
        if (state.tab === 'ficha') {
          renderFicha();
          var input = document.getElementById('ficha-search');
          if (input) {
            input.focus();
            var pos = Math.max(0, Math.min(Number(cursorPos) || 0, input.value.length));
            input.setSelectionRange(pos, pos);
          }
        }
      }
    });

    document.body.addEventListener('change', function (ev) {
      if (ev.target.id === 'cal-month') {
        state.calendarMonth = Number(ev.target.value);
        renderCalendario();
      } else if (ev.target.id === 'cal-year') {
        state.calendarYear = Number(ev.target.value);
        renderCalendario();
      } else if (ev.target.id === 'ficha-status') {
        state.fichaStatus = ev.target.value;
        if (state.tab === 'ficha') renderFicha();
      }
    });

    document.body.addEventListener('submit', function (ev) {
      if (ev.target.id === 'form-config') {
        ev.preventDefault();
        var diaria = Number(document.getElementById('cfg-diaria').value);
        var adicional = Number(document.getElementById('cfg-adicional').value);
        SystemStore.setConfig({
          valorDiaria: diaria,
          valorAdicionalPorPessoa: adicional
        });
        alert('Valores salvos.');
        renderAll();
      }
      if (ev.target.id === 'form-bloqueio') {
        ev.preventDefault();
        var ini = document.getElementById('bloqueio-inicio').value;
        var fim = document.getElementById('bloqueio-fim').value;
        var motivo = document.getElementById('bloqueio-motivo').value;
        if (!ini || !fim) return;
        if (SystemStore.nightsBetween(ini, fim) <= 0) {
          alert('Data final deve ser maior que a inicial.');
          return;
        }
        SystemStore.addBloqueio({ dataInicio: ini, dataFim: fim, motivo: motivo });
        ev.target.reset();
        renderAll();
      }
    });
  }

  function openModal(id) {
    var reserva = SystemStore.getReservas().find(function (r) {
      return r.id === id;
    });
    if (!reserva) return;
    var card = document.getElementById('reserva-modal-card');
    card.innerHTML =
      '<h2 class="sys-section-title" style="margin-bottom:0.8rem">Código ' +
      esc(reserva.codigo) +
      '</h2>' +
      '<div class="sys-modal-grid">' +
      field('nome', reserva.nome) +
      field('datas', fmtDate(reserva.dataEntrada) + ' - ' + fmtDate(reserva.dataSaida)) +
      field('gmail', reserva.email) +
      field('valor adicional', money(reserva.valorAdicional)) +
      field('numero', reserva.telefone) +
      field('horario feito a reserva', fmtDateTime(reserva.criadoEm)) +
      field('n. pessoas', reserva.pessoas) +
      field('plataforma', (reserva.plataforma || 'site').toUpperCase()) +
      field('valor total', money(reserva.valorTotal)) +
      field('metodo de pagamento', formatMetodoPagamento(reserva.metodoPagamento)) +
      '</div><div style="margin-top:0.9rem;display:flex;justify-content:space-between;gap:0.75rem;align-items:center">' +
      (reserva.status === 'cancelada'
        ? '<button class="sys-btn" style="background:rgba(114,114,114,0.6);cursor:default">reserva cancelada</button>'
        : '<button class="sys-btn" data-cancel-reserva="' +
          esc(reserva.id) +
          '" style="background:rgba(180,54,54,0.78)">cancelar reserva</button>') +
      '<button class="sys-btn" data-close-modal="true">fechar</button></div>';
    document.getElementById('reserva-modal').hidden = false;
  }

  function field(label, value) {
    return (
      '<div class="sys-modal-field"><b>' + esc(label) + '</b><span>' + esc(value) + '</span></div>'
    );
  }

  function formatMetodoPagamento(metodo) {
    var key = String(metodo || 'pix').toLowerCase();
    var map = {
      pix: 'PIX (simulação)',
      cartao_credito: 'Cartão de crédito (simulação)',
      cartao_debito: 'Cartão de débito (simulação)',
      boleto: 'Boleto (simulação)',
      transferencia: 'Transferência (simulação)'
    };
    return map[key] || 'PIX (simulação)';
  }

  function closeModal() {
    document.getElementById('reserva-modal').hidden = true;
  }

  function renderAll() {
    renderFaturamento();
    renderFicha();
    renderHistorico();
    renderCalendario();
    setActiveTab(state.tab);
  }

  bindEvents();

  async function enablePwaAfterAuth() {
    if (!('serviceWorker' in navigator)) return;
    try {
      await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    } catch (e) {}

    installPromptListener = function (ev) {
      ev.preventDefault();
      deferredInstallPrompt = ev;
      var btn = document.getElementById('btn-instalar-app');
      if (btn) btn.hidden = false;
    };
    window.addEventListener('beforeinstallprompt', installPromptListener);
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible') return;
    if (SystemStore.listarReservas) {
      SystemStore.listarReservas().then(renderAll);
      return;
    }
    renderAll();
  });
  (async function boot() {
    try {
      var session = await window.RouteGuards.requireAuth({ loginPath: 'login.html' });
      if (!session) return;
      await enablePwaAfterAuth();
      if (SystemStore.init) await SystemStore.init();
      else if (SystemStore.listarReservas) await SystemStore.listarReservas();
    } catch (errBoot) {
      console.error('Falha ao carregar reservas do Supabase:', errBoot);
      alert('Nao foi possivel carregar reservas do banco.');
    }
    renderAll();
  })();
})();
