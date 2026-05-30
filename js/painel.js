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

  function statusLabelReserva(status) {
    var s = String(status || 'pendente').toLowerCase();
    if (s === 'confirmada' || s === 'ativa') return 'Confirmada';
    if (s === 'cancelada') return 'Cancelada';
    return 'Pendente';
  }

  function valorReservaTexto(r) {
    if (!r) return '—';
    if (r.requerOrcamento) {
      if (window.ReservaPrecos && window.ReservaPrecos.faixaOrcamentoReserva) {
        var faixa =
          r.valorMin != null && r.valorMax != null
            ? { valorMin: r.valorMin, valorMax: r.valorMax }
            : window.ReservaPrecos.faixaOrcamentoReserva(r);
        if (faixa.valorMin > 0 && faixa.valorMax > 0) {
          return window.ReservaPrecos.formatFaixaOrcamentoTexto(faixa);
        }
      }
      return 'Orçamento personalizado';
    }
    if (r.valorTotal == null) return 'Orçamento personalizado';
    return money(r.valorTotal);
  }

  function noitesReservaTexto(r) {
    if (r && r.noites) return String(r.noites);
    if (r && SystemStore.nightsBetween) {
      var n = SystemStore.nightsBetween(r.dataEntrada, r.dataSaida);
      return n > 0 ? String(n) : '—';
    }
    return '—';
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

  /** Mesma lógica do site: pasta imagem/imagem quartos/{id}/ ou img do catálogo. */
  function imagemPrincipalQuartoSite(q) {
    if (!q) return '';
    if (typeof window.quartoImagensDoCatalogo === 'function') {
      var imgs = window.quartoImagensDoCatalogo(q);
      if (imgs && imgs.length) return String(imgs[0]).trim();
    }
    return q.img ? String(q.img).trim() : '';
  }

  function imagensQuartoSite(q) {
    if (!q) return [];
    if (typeof window.quartoImagensDoCatalogo === 'function') {
      return window.quartoImagensDoCatalogo(q) || [];
    }
    var img = q.img ? String(q.img).trim() : '';
    return img ? [img] : [];
  }

  /** Nome amigável do quarto na ficha/modal (catálogo em window.QUARTOS_SITE). */
  function quartoTituloPorIdPainel(quartoId) {
    var id = quartoId != null && String(quartoId).trim() !== '' ? String(quartoId).trim() : '';
    if (!id) return 'Imóvel inteiro / quarto não especificado';
    var list = window.QUARTOS_SITE || [];
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].id) === id) return list[i].titulo || id;
    }
    return id;
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

  function syncHeaderSearchInput(val) {
    var el = document.getElementById('app-header-search');
    if (el && document.activeElement !== el) el.value = val || '';
  }

  function syncFichaSearchInputs(val) {
    ['ficha-search', 'ficha-search-mobile'].forEach(function (id) {
      var inp = document.getElementById(id);
      if (inp) inp.value = val || '';
    });
    syncHeaderSearchInput(val);
  }

  function pickFichaViewForReserva(r) {
    var hoje = new Date();
    var hojeIso = SystemStore.toIsoDate(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()));
    var status = (r.status || '').toLowerCase();
    var finalizada = r.dataSaida && r.dataSaida < hojeIso;
    if (status === 'cancelada' || finalizada) return 'historico';
    return 'cliente';
  }

  function findQuartosByGlobalQuery(q) {
    var term = String(q || '').trim().toLowerCase();
    if (!term) return [];
    return (window.QUARTOS_SITE || []).filter(function (qt) {
      var blob = [qt.id, qt.titulo, qt.tipo, qt.desc]
        .map(function (v) {
          return String(v || '').toLowerCase();
        })
        .join(' ');
      return blob.indexOf(term) !== -1;
    });
  }

  function executeHeaderSearch(opts) {
    opts = opts || {};
    var input = document.getElementById('app-header-search');
    if (!input) return;
    var q = String(input.value || '').trim();
    if (!q) {
      input.focus();
      return;
    }

    var reservas = SystemStore.searchReservas(SystemStore.getReservas(), q);
    if (reservas.length) {
      var termLower = q.toLowerCase();
      var exact = reservas.find(function (r) {
        return String(r.codigo || '').toLowerCase() === termLower;
      });
      var reserva = exact || reservas[0];
      state.fichaQuery = q;
      state.fichaView = pickFichaViewForReserva(reserva);
      setActiveTab('ficha');
      renderFicha();
      syncFichaSearchInputs(q);
      if (opts.openModal !== false) openModal(reserva.id);
      return;
    }

    var quartos = findQuartosByGlobalQuery(q);
    if (quartos.length) {
      setActiveTab('quartos');
      renderQuartos();
      if (quartos.length === 1) {
        setTimeout(function () {
          var btn = document.querySelector('[data-quarto-edit="' + quartos[0].id + '"]');
          var card = btn && btn.closest ? btn.closest('.sys-quarto-card') : null;
          if (card) card.scrollIntoView({ behavior: 'auto', block: 'nearest' });
        }, 0);
      }
      return;
    }

    state.fichaQuery = q;
    setActiveTab('ficha');
    renderFicha();
    syncFichaSearchInputs(q);
    if (opts.showAlert !== false) alert('Nenhum resultado para "' + q + '".');
  }

  function setActiveTab(tab) {
    state.tab = tab;
    document.querySelectorAll('.sys-nav-btn[data-tab]').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tab);
    });
    document.querySelectorAll('.sys-tab').forEach(function (sec) {
      sec.classList.toggle('active', sec.id === 'tab-' + tab);
    });
    var crumb = document.getElementById('sys-breadcrumb-current');
    if (crumb) {
      var labels = {
        faturamento: 'Faturamento',
        ficha: 'Ficha de reserva',
        quartos: 'Quartos',
        calendario: 'Configuração'
      };
      crumb.textContent = labels[tab] || tab;
    }
    if (window.innerWidth <= 980) {
      var shell = document.querySelector('.sys-shell');
      var toggle = document.getElementById('sys-mobile-toggle');
      if (shell) shell.classList.remove('menu-open');
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
    }
  }

  function renderFaturamento() {
    var el = document.getElementById('tab-faturamento');
    if (!el) return;
    var reservasBase = getReservasAtivas();
    var reservas = filterReservasByPeriodo(reservasBase, state.periodo);
    var f = SystemStore.faturamentoPorPlataforma(reservas);
    var qtdReservas = reservas.length;
    var meiosPagamento = renderMeiosPagamento(reservas);
    var graficoReservas = renderGraficoReservasDia(reservas);
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
      '<div class="sys-reservas-chart-desktop-only" style="margin-top:1.2rem">' +
      graficoReservas +
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
      { key: 'cartao_credito', icon: '▭', label: 'Cartão de crédito', value: 0 },
      { key: 'cartao_debito', icon: '▭', label: 'Cartão de débito', value: 0 }
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

  function reservasCountsPorDiaNoMesAtual(reservas) {
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
    return {
      year: year,
      month: month,
      daysInMonth: daysInMonth,
      counts: counts,
      maxCount: maxCount,
      axisMax: chartAxisMaxFromCounts(maxCount)
    };
  }

  function chartAxisMaxFromCounts(maxCount) {
    var n = Math.max(0, Math.floor(Number(maxCount) || 0));
    if (n === 0) return 1;
    if (n <= 5) return n;
    if (n <= 10) return 10;
    var step = Math.ceil(n / 4);
    return step * 4;
  }

  function chartYTicks(axisMax) {
    axisMax = Math.max(1, Math.floor(Number(axisMax) || 1));
    if (axisMax <= 6) {
      var small = [];
      for (var i = 0; i <= axisMax; i++) small.push(i);
      return small;
    }
    var ticks = [0];
    var step = Math.max(1, Math.ceil(axisMax / 4));
    for (var v = step; v < axisMax; v += step) ticks.push(v);
    if (ticks[ticks.length - 1] !== axisMax) ticks.push(axisMax);
    return ticks;
  }

  function chartShowDayLabel(day, total) {
    if (total <= 14) return true;
    if (day === 1 || day === total) return true;
    if (total <= 21) return day % 2 === 0;
    return day % 5 === 0;
  }

  function renderGraficoReservasDia(reservas) {
    var agg = reservasCountsPorDiaNoMesAtual(reservas);
    var daysInMonth = agg.daysInMonth;
    var counts = agg.counts;
    var axisMax = agg.axisMax;

    var width = 1080;
    var height = 288;
    var left = 46;
    var right = 16;
    var top = 14;
    var bottom = 34;
    var plotW = width - left - right;
    var plotH = height - top - bottom;
    var yTicks = chartYTicks(axisMax);

    var gridLines = '';
    var yAxisTicks = '';
    yTicks.forEach(function (tickVal) {
      var gy = top + plotH - (tickVal / axisMax) * plotH;
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
      yAxisTicks +=
        '<text class="sys-chart-y-tick" x="' +
        (left - 10).toFixed(2) +
        '" y="' +
        (gy + 4).toFixed(2) +
        '" text-anchor="end">' +
        tickVal +
        '</text>';
    });

    var baselineY = top + plotH;
    var axisBaseline =
      '<line x1="' +
      left +
      '" y1="' +
      baselineY.toFixed(2) +
      '" x2="' +
      (left + plotW) +
      '" y2="' +
      baselineY.toFixed(2) +
      '" class="sys-chart-axis-line" />';

    var pointsArr = counts.map(function (value, idx) {
      var x = left + (idx * plotW) / Math.max(1, counts.length - 1);
      var y = top + plotH - (value / axisMax) * plotH;
      return { x: x, y: y, day: idx + 1, count: value };
    });

    function smoothLinePathCatmull(points) {
      if (!points.length) return '';
      function fx(n) {
        return Number(n).toFixed(2);
      }
      if (points.length === 1) {
        return 'M ' + fx(points[0].x) + ' ' + fx(points[0].y);
      }
      if (points.length === 2) {
        return (
          'M ' +
          fx(points[0].x) +
          ' ' +
          fx(points[0].y) +
          ' L ' +
          fx(points[1].x) +
          ' ' +
          fx(points[1].y)
        );
      }
      var d = 'M ' + fx(points[0].x) + ' ' + fx(points[0].y);
      for (var i = 0; i < points.length - 1; i++) {
        var p0 =
          i > 0
            ? points[i - 1]
            : { x: 2 * points[i].x - points[i + 1].x, y: 2 * points[i].y - points[i + 1].y };
        var p1 = points[i];
        var p2 = points[i + 1];
        var p3 =
          i + 2 < points.length
            ? points[i + 2]
            : { x: 2 * points[i + 1].x - points[i].x, y: 2 * points[i + 1].y - points[i].y };
        var c1x = p1.x + (p2.x - p0.x) / 6;
        var c1y = p1.y + (p2.y - p0.y) / 6;
        var c2x = p2.x - (p3.x - p1.x) / 6;
        var c2y = p2.y - (p3.y - p1.y) / 6;
        d += ' C ' + fx(c1x) + ' ' + fx(c1y) + ', ' + fx(c2x) + ' ' + fx(c2y) + ', ' + fx(p2.x) + ' ' + fx(p2.y);
      }
      return d;
    }

    var smoothPath = smoothLinePathCatmull(pointsArr);
    var areaPath = '';
    if (smoothPath && pointsArr.length >= 2) {
      var lastPt = pointsArr[pointsArr.length - 1];
      var firstPt = pointsArr[0];
      areaPath =
        smoothPath +
        ' L ' +
        lastPt.x.toFixed(2) +
        ' ' +
        baselineY.toFixed(2) +
        ' L ' +
        firstPt.x.toFixed(2) +
        ' ' +
        baselineY.toFixed(2) +
        ' Z';
    }

    var xAxisLabels = pointsArr
      .filter(function (p) {
        return chartShowDayLabel(p.day, daysInMonth);
      })
      .map(function (p) {
        return (
          '<text class="sys-chart-x-tick" x="' +
          p.x.toFixed(2) +
          '" y="' +
          (baselineY + 22).toFixed(2) +
          '" text-anchor="middle">' +
          String(p.day).padStart(2, '0') +
          '</text>'
        );
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
      '<article class="sys-card sys-reservas-chart-card sys-reservas-chart-card--desktop">' +
      '<div class="sys-chart-head">Reservas feitas por dia</div>' +
      '<div class="sys-chart-wrap">' +
      '<svg viewBox="0 0 ' +
      width +
      ' ' +
      height +
      '" class="sys-chart-svg" role="img" aria-label="Grafico de reservas por dia">' +
      '<defs>' +
      '<linearGradient id="reservas-chart-area-grad" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#2d6a4a" stop-opacity="0.28"/>' +
      '<stop offset="100%" stop-color="#2d6a4a" stop-opacity="0"/>' +
      '</linearGradient></defs>' +
      '<g>' +
      axisBaseline +
      gridLines +
      yAxisTicks +
      xAxisLabels +
      (areaPath
        ? '<path d="' + areaPath + '" class="sys-chart-area" fill="url(#reservas-chart-area-grad)" />'
        : '') +
      (smoothPath
        ? '<path d="' + smoothPath + '" class="sys-chart-line" fill="none" />'
        : '') +
      '<line class="sys-chart-crosshair" x1="' +
      left +
      '" y1="' +
      top +
      '" x2="' +
      left +
      '" y2="' +
      baselineY.toFixed(2) +
      '" hidden />' +
      '<circle class="sys-chart-dot" cx="' +
      left +
      '" cy="' +
      baselineY.toFixed(2) +
      '" r="4.5" hidden />' +
      hitAreas +
      '</g></svg>' +
      '<div class="sys-chart-tooltip" hidden></div>' +
      '</div>' +
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
      var scroller = wrap.closest('.sys-reservas-mobile-scroll');
      if (scroller) {
        scroller.addEventListener('scroll', hideAll, { passive: true });
      }
      hits.forEach(function (hit) {
        function show() {
          var day = hit.getAttribute('data-day');
          var count = hit.getAttribute('data-count');
          var useBbox = hit.getAttribute('data-use-bbox') === '1';
          var dateLab = hit.getAttribute('data-date-label');
          tooltip.textContent =
            (dateLab || String(day).padStart(2, '0')) + ' - ' + count + ' reserva' + (count === '1' ? '' : 's');
          tooltip.hidden = false;
          var wr = wrap.getBoundingClientRect();
          var tipW = 140;
          if (useBbox) {
            var cr = card.getBoundingClientRect();
            var hr = hit.getBoundingClientRect();
            var tipX = Math.max(8, Math.min(cr.width - tipW - 8, hr.left + hr.width / 2 - cr.left - tipW / 2));
            var tipY = Math.max(8, hr.top - cr.top - 36);
            tooltip.style.left = tipX + 'px';
            tooltip.style.top = tipY + 'px';
            if (crosshair) crosshair.setAttribute('hidden', 'hidden');
            if (dot) dot.setAttribute('hidden', 'hidden');
          } else {
            var x = Number(hit.getAttribute('data-x') || 0);
            var y = Number(hit.getAttribute('data-y') || 0);
            var cr = card.getBoundingClientRect();
            var svgEl = wrap.querySelector('svg');
            var vb =
              svgEl && svgEl.viewBox && svgEl.viewBox.baseVal ? svgEl.viewBox.baseVal : { width: 1080, height: 288 };
            var vbW = vb.width || 1080;
            var vbH = vb.height || 288;
            var scaleX = wr.width / vbW;
            var scaleY = wr.height / vbH;
            var tipX2 = Math.max(8, Math.min(cr.width - tipW - 8, wr.left - cr.left + x * scaleX - tipW / 2));
            var tipY2 = Math.max(8, wr.top - cr.top + y * scaleY - 48);
            tooltip.style.left = tipX2 + 'px';
            tooltip.style.top = tipY2 + 'px';
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
        }
        hit.addEventListener('mouseenter', show);
        hit.addEventListener('mousemove', show);
        hit.addEventListener('mouseleave', hideAll);
        hit.addEventListener('touchstart', show, { passive: true });
      });
      wrap.addEventListener('mouseleave', hideAll);
    });
  }

  function renderRows(list, withOpen) {
    if (!list.length) return '<p class="sys-empty">Nenhuma reserva encontrada.</p>';
    var html = '<div class="sys-table-wrap">';
    html +=
      '<div class="sys-row header"><div>nome</div><div>numero</div><div>codigo</div><div>quarto</div><div>app</div><div>Total</div>';
    html += withOpen ? '<div></div></div>' : '<div></div></div>';
    list.forEach(function (r) {
      html += '<div class="sys-row">';
      html += '<div class="sys-cell">' + esc(r.nome) + '</div>';
      html += '<div class="sys-cell">' + esc(r.telefone) + '</div>';
      html += '<div class="sys-cell">' + esc(r.codigo) + '</div>';
      html += '<div class="sys-cell">' + esc(quartoTituloPorIdPainel(r.quartoId)) + '</div>';
      html += '<div class="sys-cell">' + esc((r.plataforma || 'site').toUpperCase()) + '</div>';
      html += '<div class="sys-cell">' + esc(valorReservaTexto(r)) + '</div>';
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
      if (state.fichaStatus === 'pendente') return status === 'pendente';
      if (state.fichaStatus === 'confirmada') return status === 'confirmada' || status === 'ativa';
      if (state.fichaStatus === 'ativa') return status !== 'cancelada';
      return true;
    });
    var el = document.getElementById('tab-ficha');
    if (!el) return;
    var rows = list.length
      ? list
          .slice(0, 60)
          .map(function (r) {
            var statusTxt = statusLabelReserva(r.status);
            return (
              '<div class="sys-ficha-row">' +
              '<div class="sys-ficha-col-nome">' +
              '<span class="sys-nome-desktop">' + esc(r.nome || 'Sem nome') + '</span>' +
              '<span class="sys-nome-mobile">' + esc(firstNameOnly(r.nome || 'Sem nome')) + '</span>' +
              '<div class="sys-ficha-quarto-line">Quarto: ' +
              esc(quartoTituloPorIdPainel(r.quartoId)) +
              '</div>' +
              '</div>' +
              '<div class="sys-ficha-col-valor">' +
              esc(valorReservaTexto(r)) +
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
              '<div class="sys-h-pill">Quarto: ' +
              esc(quartoTituloPorIdPainel(r.quartoId)) +
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

    var mobileCards = list.length
      ? list
          .slice(0, 60)
          .map(function (r) {
            var statusTxt = statusLabelReserva(r.status);
            var stClass = statusTxt === 'Cancelada' ? 'sys-ficha-m-card__pill--off' : 'sys-ficha-m-card__pill--on';
            return (
              '<article class="sys-ficha-m-card">' +
              '<div class="sys-ficha-m-card__top">' +
              '<span class="sys-ficha-m-card__code">' +
              esc(r.codigo || '—') +
              '</span>' +
              '<span class="sys-ficha-m-card__pill ' +
              stClass +
              '">' +
              esc(statusTxt) +
              '</span>' +
              '</div>' +
              '<div class="sys-ficha-m-card__nome">' +
              esc(r.nome || 'Sem nome') +
              '</div>' +
              '<div class="sys-ficha-m-card__quarto">' +
              esc(quartoTituloPorIdPainel(r.quartoId)) +
              '</div>' +
              '<div class="sys-ficha-m-card__row">' +
              '<span class="sys-ficha-m-card__label">Total</span>' +
              '<span class="sys-ficha-m-card__valor">' +
              esc(valorReservaTexto(r)) +
              '</span>' +
              '</div>' +
              '<div class="sys-ficha-m-card__foot">' +
              '<span class="sys-ficha-m-card__time">' +
              esc(fmtTimeBrasilia(r.criadoEm)) +
              '</span>' +
              '<button type="button" class="sys-btn sys-ficha-m-card__btn" data-open="' +
              esc(r.id) +
              '">Abrir</button>' +
              '</div>' +
              '</article>'
            );
          })
          .join('')
      : '<div class="sys-ficha-empty sys-ficha-empty--mob">Nenhuma ficha encontrada.</div>';

    var statusSelectHtml =
      state.fichaView === 'historico'
        ? '<label class="sys-ficha-status-wrap"><span>Status</span><select id="ficha-status" class="sys-ficha-status-select">' +
          '<option value="todos"' +
          (state.fichaStatus === 'todos' ? ' selected' : '') +
          '>Todos</option>' +
          '<option value="pendente"' +
          (state.fichaStatus === 'pendente' ? ' selected' : '') +
          '>Pendente</option>' +
          '<option value="confirmada"' +
          (state.fichaStatus === 'confirmada' ? ' selected' : '') +
          '>Confirmada</option>' +
          '<option value="ativa"' +
          (state.fichaStatus === 'ativa' ? ' selected' : '') +
          '>Ativas</option>' +
          '<option value="cancelada"' +
          (state.fichaStatus === 'cancelada' ? ' selected' : '') +
          '>Cancelada</option>' +
          '</select></label>'
        : '';

    var statusSelectMobileHtml =
      state.fichaView === 'historico'
        ? '<label class="sys-ficha-status-wrap sys-ficha-status-wrap--mob"><span>Status</span><select id="ficha-status-mobile" class="sys-ficha-status-select">' +
          '<option value="todos"' +
          (state.fichaStatus === 'todos' ? ' selected' : '') +
          '>Todos</option>' +
          '<option value="pendente"' +
          (state.fichaStatus === 'pendente' ? ' selected' : '') +
          '>Pendente</option>' +
          '<option value="confirmada"' +
          (state.fichaStatus === 'confirmada' ? ' selected' : '') +
          '>Confirmada</option>' +
          '<option value="ativa"' +
          (state.fichaStatus === 'ativa' ? ' selected' : '') +
          '>Ativas</option>' +
          '<option value="cancelada"' +
          (state.fichaStatus === 'cancelada' ? ' selected' : '') +
          '>Cancelada</option>' +
          '</select></label>'
        : '';

    var tabsHtml =
      '<div class="sys-ficha-top-tabs">' +
      '<button type="button" class="sys-ficha-tab' +
      (state.fichaView === 'cliente' ? ' active' : '') +
      '" data-ficha-view="cliente">Ficha de cliente</button>' +
      '<button type="button" class="sys-ficha-tab' +
      (state.fichaView === 'historico' ? ' active' : '') +
      '" data-ficha-view="historico">Historico de ficha</button>' +
      '</div>';

    var filtersDesktopHtml =
      '<div class="sys-ficha-filters">' +
      '<input id="ficha-search" class="sys-ficha-search sys-ficha-search-input" placeholder="Pesquisar" value="' +
      esc(state.fichaQuery) +
      '" />' +
      statusSelectHtml +
      '</div>';

    var filtersMobileHtml =
      '<div class="sys-ficha-filters sys-ficha-filters--mob">' +
      '<input id="ficha-search-mobile" class="sys-ficha-search sys-ficha-search-input" placeholder="Pesquisar" value="' +
      esc(state.fichaQuery) +
      '" />' +
      statusSelectMobileHtml +
      '</div>';

    var desktopBody =
      state.fichaView === 'historico'
        ? '<div class="sys-ficha-table-head"><div>Nome / quarto</div><div>Preco</div><div>Status</div></div>' +
          '<div class="sys-ficha-table-body">' +
          rows +
          '</div>'
        : cards;

    el.innerHTML =
      '<div class="sys-ficha-root">' +
      '<div class="sys-ficha-view sys-ficha-view--desktop">' +
      '<div class="sys-ficha-board">' +
      tabsHtml +
      filtersDesktopHtml +
      desktopBody +
      '</div></div>' +
      '<div class="sys-ficha-view sys-ficha-view--mobile">' +
      '<div class="sys-ficha-board sys-ficha-board--mobile">' +
      '<div class="sys-ficha-top-tabs sys-ficha-top-tabs--mob">' +
      '<button type="button" class="sys-ficha-tab' +
      (state.fichaView === 'cliente' ? ' active' : '') +
      '" data-ficha-view="cliente">Cliente</button>' +
      '<button type="button" class="sys-ficha-tab' +
      (state.fichaView === 'historico' ? ' active' : '') +
      '" data-ficha-view="historico">Historico</button>' +
      '</div>' +
      filtersMobileHtml +
      '<div class="sys-ficha-m-scroll">' +
      mobileCards +
      '</div></div></div></div>';
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
    if (!el) return;
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

  function countReservasAtivasSemQuarto() {
    return SystemStore.getReservas().filter(function (r) {
      if ((r.status || '').toLowerCase() === 'cancelada') return false;
      var rq = r.quartoId != null && String(r.quartoId).trim() !== '' ? String(r.quartoId) : null;
      return rq == null;
    }).length;
  }

  function countReservasAtivasNoQuarto(quartoId) {
    var qid = String(quartoId || '');
    return SystemStore.getReservas().filter(function (r) {
      if ((r.status || '').toLowerCase() === 'cancelada') return false;
      var rq = r.quartoId != null && String(r.quartoId).trim() !== '' ? String(r.quartoId) : null;
      if (rq == null) return false;
      return rq === qid;
    }).length;
  }

  var QUARTO_AMENITY_OPTS = [
    { key: 'arCondicionado', label: 'Ar-condicionado' },
    { key: 'wifi', label: 'Wi-Fi' },
    { key: 'banheiroPrivativo', label: 'Banheiro privativo' },
    { key: 'banheiroCompartilhado', label: 'Banheiro compartilhado' },
    { key: 'cozinhaCompacta', label: 'Cozinha compacta privativa' },
    { key: 'maquinaLavar', label: 'Máquina de lavar' },
    { key: 'ventilador', label: 'Ventilador' },
    { key: 'guardaRoupa', label: 'Guarda-roupa' }
  ];

  function getQuartoDescMaximo() {
    var cap = Number(window.QUARTOS_DESC_MAX) > 0 ? Math.floor(Number(window.QUARTOS_DESC_MAX)) : 300;
    return Math.min(Math.max(cap, 1), 300);
  }

  var quaEditorBlobUrl = null;

  function revogarBlobQuartoEditor() {
    if (quaEditorBlobUrl) {
      try {
        URL.revokeObjectURL(quaEditorBlobUrl);
      } catch (eRev) {}
      quaEditorBlobUrl = null;
    }
  }

  function tryUploadQuartoCoverBlob(file) {
    return new Promise(function (resolve) {
      var sb = window.SupabaseClient;
      if (!sb || !sb.storage) {
        resolve(null);
        return;
      }
      var rawExt = String(file.name || '')
        .split('.')
        .pop();
      var ext = (rawExt || 'webp').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!ext || ext.length > 5) ext = 'webp';
      var key =
        'quarto/' +
        Date.now().toString(36) +
        '-' +
        Math.random().toString(36).slice(2, 9) +
        '.' +
        ext;
      sb.storage
        .from('site-midias')
        .upload(key, file, {
          contentType: file.type || 'image/jpeg',
          cacheControl: '86400'
        })
        .then(function (res) {
          if (res.error) {
            console.warn('Storage upload:', res.error);
            resolve(null);
            return;
          }
          var pub = sb.storage.from('site-midias').getPublicUrl(key);
          var url = pub && pub.data && pub.data.publicUrl ? pub.data.publicUrl : null;
          resolve(url);
        })
        .catch(function (errUp) {
          console.warn(errUp);
          resolve(null);
        });
    });
  }

  function wireQuartoEditorImagemUI(q) {
    revogarBlobQuartoEditor();
    var inp = document.getElementById('qua-img');
    var prev = document.getElementById('qua-img-preview');
    var drop = document.getElementById('qua-img-dropzone');
    var fileInp = document.getElementById('qua-img-file');
    var grid = document.getElementById('qua-galeria-grid');
    if (!inp || !prev || !drop || !fileInp) return;

    function showPreviewSrc(src) {
      if (!src) {
        prev.hidden = true;
        prev.removeAttribute('src');
        return;
      }
      prev.hidden = false;
      prev.src = src;
    }

    function syncFromInput() {
      revogarBlobQuartoEditor();
      showPreviewSrc(String(inp.value || '').trim());
    }

    function handleFile(file) {
      if (!file || !/^image\//.test(file.type)) {
        alert('Escolha um ficheiro de imagem (JPG, PNG, WebP, etc.).');
        return;
      }
      if (file.size > 8 * 1024 * 1024) {
        alert('Imagem demasiado grande (máximo 8 MB).');
        return;
      }
      revogarBlobQuartoEditor();
      quaEditorBlobUrl = URL.createObjectURL(file);
      showPreviewSrc(quaEditorBlobUrl);

      tryUploadQuartoCoverBlob(file).then(function (publicUrl) {
        if (publicUrl) {
          revogarBlobQuartoEditor();
          inp.value = publicUrl;
          showPreviewSrc(publicUrl);
          return;
        }
        revogarBlobQuartoEditor();
        if (!String(inp.value || '').trim()) showPreviewSrc('');
        alert(
          'Upload para nuvem desligado. Escolha uma miniatura na galeria abaixo ou indique o caminho da foto (ex.: imagem/foto.webp) no campo URL.'
        );
      });
    }

    inp.addEventListener('input', syncFromInput);
    inp.addEventListener('change', syncFromInput);

    drop.addEventListener('dragover', function (ev) {
      ev.preventDefault();
      drop.classList.add('sys-img-dropzone--hover');
    });
    drop.addEventListener('dragleave', function () {
      drop.classList.remove('sys-img-dropzone--hover');
    });
    drop.addEventListener('drop', function (ev) {
      ev.preventDefault();
      drop.classList.remove('sys-img-dropzone--hover');
      var f = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
      if (f) handleFile(f);
    });

    fileInp.addEventListener('change', function () {
      var f = fileInp.files && fileInp.files[0];
      if (f) handleFile(f);
      fileInp.value = '';
    });

    var pickerUrls = [];
    if (q && typeof window.quartoImagensDaPasta === 'function') {
      window.quartoImagensDaPasta(String(q.id || '').trim()).forEach(function (u) {
        u = String(u || '').trim();
        if (u && pickerUrls.indexOf(u) === -1) pickerUrls.push(u);
      });
    }
    if (window.GALERIA_IMAGENS_URLS && window.GALERIA_IMAGENS_URLS.length) {
      window.GALERIA_IMAGENS_URLS.forEach(function (item) {
        var u = String((item && item.url) || '').trim();
        if (u && pickerUrls.indexOf(u) === -1) pickerUrls.push(u);
      });
    }
    if (grid && pickerUrls.length) {
      grid.innerHTML = pickerUrls.map(function (u) {
        return (
          '<button type="button" class="sys-galeria-thumb" data-img-path="' +
          esc(u) +
          '" title="' +
          esc(u) +
          '">' +
          '<img src="' +
          esc(u) +
          '" alt="" loading="lazy" decoding="async" width="88" height="62" />' +
          '</button>'
        );
      }).join('');
      grid.addEventListener('click', function (ev) {
        var b = ev.target.closest && ev.target.closest('.sys-galeria-thumb');
        if (!b) return;
        var p = b.getAttribute('data-img-path');
        if (p) {
          inp.value = p;
          syncFromInput();
        }
      });
    }

    if (q && !String(inp.value || '').trim()) {
      var siteImg = imagemPrincipalQuartoSite(q);
      if (siteImg) showPreviewSrc(siteImg);
    }

    syncFromInput();
  }

  function closeQuartoEditorModal() {
    revogarBlobQuartoEditor();
    var m = document.getElementById('quarto-editor-modal');
    if (m) m.setAttribute('hidden', '');
    var card = document.getElementById('quarto-editor-card');
    if (card) card.innerHTML = '';
  }

  function buildQuartoEditorFormHTML(q) {
    var isEdit = !!(q && q.id);
    var a = (q && q.amenities) || {};
    var descMax = getQuartoDescMaximo();
    var idVal = isEdit ? String(q.id) : '';
    var idField =
      '<label class="sys-label">Identificador no site (URL)<br />' +
      (isEdit
        ? '<input class="sys-input" type="text" id="qua-id" value="' +
          esc(idVal) +
          '" readonly required />'
        : '<input class="sys-input" type="text" id="qua-id" required maxlength="80" placeholder="ex: meu-quarto" />') +
      '</label>';
    var checks = QUARTO_AMENITY_OPTS.map(function (opt) {
      var on = a[opt.key] ? ' checked' : '';
      return (
        '<label><input type="checkbox" id="qua-am-' +
        esc(opt.key) +
        '"' +
        on +
        ' /> ' +
        esc(opt.label) +
        '</label>'
      );
    }).join('');
    var galeriaLines = '';
    if (a.galeria && Array.isArray(a.galeria)) {
      galeriaLines = a.galeria
        .map(function (u) {
          return String(u || '').trim();
        })
        .filter(Boolean)
        .join('\n');
    }
    var ordemVal = q && q.ordem != null ? String(q.ordem) : '';
    return (
      '<form id="form-quarto-editor" class="sys-form sys-quarto-editor-form">' +
      '<h3>' +
      esc(isEdit ? 'Editar quarto' : 'Novo quarto') +
      '</h3>' +
      '<p class="sys-help">Alterações gravam neste navegador (armazenamento local) e aparecem no site, na reserva e no carrossel neste dispositivo.</p>' +
      '<input type="hidden" id="qua-ordem" value="' +
      esc(ordemVal) +
      '" />' +
      idField +
      '<label class="sys-label">Nome do quarto<br /><input class="sys-input" type="text" id="qua-titulo" required maxlength="120" value="' +
      esc(q ? q.titulo || '' : '') +
      '" /></label>' +
      '<label class="sys-label">Subtítulo / estilo (linha abaixo do nome)<br /><input class="sys-input" type="text" id="qua-tipo" maxlength="200" value="' +
      esc(q ? q.tipo || '' : '') +
      '" /></label>' +
      '<label class="sys-label">Descrição (máx. ' +
      esc(String(descMax)) +
      ' caracteres)<br /><textarea class="sys-input" id="qua-desc" maxlength="' +
      esc(String(descMax)) +
      '" rows="6">' +
      esc(q ? String(q.desc || '').substring(0, descMax) : '') +
      '</textarea></label>' +
      '<div class="sys-quarto-editor-grid">' +
      '<label class="sys-label">Capacidade (pessoas)<br /><input class="sys-input" type="number" id="qua-cap" min="1" max="30" value="' +
      esc(String(q && q.capacidade != null ? q.capacidade : 2)) +
      '" /></label>' +
      '<label class="sys-label">Metros quadrados (m²)<br /><input class="sys-input" type="number" id="qua-m2" min="0" max="999" value="' +
      esc(String(a.metros2 != null ? a.metros2 : '')) +
      '" /></label>' +
      '<label class="sys-label">Valor exibido (ex: R$ 150)<br /><input class="sys-input" type="text" id="qua-preco" maxlength="40" value="' +
      esc(q ? q.preco || '' : '') +
      '" /></label>' +
      '<label class="sys-label">Rótulo do valor<br /><input class="sys-input" type="text" id="qua-preco-label" maxlength="40" value="' +
      esc(q ? q.precoLabel || 'Noite' : 'Noite') +
      '" /></label>' +
      '<label class="sys-label">Camas de casal (quantidade)<br /><input class="sys-input" type="number" id="qua-camas-casal" min="0" max="20" value="' +
      esc(String(a.camasCasal != null ? a.camasCasal : 0)) +
      '" /></label>' +
      '<label class="sys-label">Camas de solteiro (quantidade)<br /><input class="sys-input" type="number" id="qua-camas-solteiro" min="0" max="20" value="' +
      esc(String(a.camasSolteiro != null ? a.camasSolteiro : 0)) +
      '" /></label>' +
      '</div>' +
      '<fieldset><legend>Sobre o quarto — selecione o que se aplica</legend>' +
      '<div class="sys-quarto-amenity-grid">' +
      checks +
      '</div></fieldset>' +
      '<fieldset class="sys-quarto-img-fieldset"><legend>Foto principal do quarto</legend>' +
      '<p class="sys-help">A foto exibida no site vem da pasta <code>imagem/imagem quartos/{id}/</code>. Use as miniaturas abaixo ou indique o caminho <code>imagem/…</code>.</p>' +
      '<label id="qua-img-dropzone" class="sys-img-dropzone" for="qua-img-file">' +
      '<span class="sys-img-dropzone-text">Arrastar imagem aqui · ou clicar para abrir o explorador</span>' +
      '<input type="file" id="qua-img-file" class="sys-img-dropzone-file" accept="image/*" />' +
      '</label>' +
      '<div class="sys-quarto-img-preview-wrap">' +
      '<img id="qua-img-preview" class="sys-quarto-img-preview" alt="" width="240" height="160" loading="lazy" decoding="async" hidden />' +
      '</div>' +
      '<label class="sys-label">Caminho ou URL da imagem (gravado no quarto)<br /><input class="sys-input" type="text" id="qua-img" maxlength="2000" value="' +
      esc(q ? imagemPrincipalQuartoSite(q) || q.img || '' : '') +
      '" placeholder="imagem/imagem quartos/tem-tem/quarto_detalhe_web.webp" /></label>' +
      '<details class="sys-galeria-site-picker"><summary>Fotos do quarto no site (pasta + galeria)</summary>' +
      '<p class="sys-help">Clique numa miniatura para usar a mesma imagem que aparece no site.</p>' +
      '<div id="qua-galeria-grid" class="sys-galeria-mini-grid"></div></details>' +
      '</fieldset>' +
      '<label class="sys-label">Texto alternativo da imagem<br />' +
      '<span class="sys-help" style="display:block;margin:0.25rem 0 0.4rem">Descreve a foto para quem não a vê (leitores de ecrã) e para o Google. Ex.: «Quarto com cama de casal e vista para o jardim».</span>' +
      '<input class="sys-input" type="text" id="qua-alt" maxlength="200" value="' +
      esc(q ? q.alt || '' : '') +
      '" /></label>' +
      '<label class="sys-label">Mais imagens (uma URL por linha; opcional)<br /><textarea class="sys-input" id="qua-imagens-extra" rows="3" placeholder="https://...">' +
      esc(galeriaLines) +
      '</textarea></label>' +
      '<div class="sys-quarto-editor-actions">' +
      '<button type="button" class="sys-btn sys-btn--ghost" data-quarto-modal-close="true">Cancelar</button>' +
      '<button type="submit" class="sys-btn">Salvar quarto</button>' +
      '</div></form>'
    );
  }

  function openQuartoEditor(id) {
    var list = window.QUARTOS_SITE || [];
    var q = id ? list.find(function (x) { return String(x.id) === String(id); }) : null;
    if (id && !q) {
      alert('Quarto não encontrado na lista atual.');
      return;
    }
    var card = document.getElementById('quarto-editor-card');
    var modal = document.getElementById('quarto-editor-modal');
    if (!card || !modal) return;
    card.innerHTML = buildQuartoEditorFormHTML(q);
    wireQuartoEditorImagemUI(q);
    modal.removeAttribute('hidden');
  }

  function tryDeleteQuarto(id) {
    if (!id || !SystemStore.apagarQuartoCatalog) {
      alert('Exclusão indisponível (função ausente).');
      return;
    }
    var list = window.QUARTOS_SITE || [];
    var q = list.find(function (x) { return String(x.id) === String(id); });
    var titulo = q ? q.titulo : id;
    var n = countReservasAtivasNoQuarto(id);
    var msg =
      'Apagar o quarto "' +
      titulo +
      '"?\n\nEle deixa de aparecer no site, na página Quartos, na reserva e neste painel.';
    if (n > 0) {
      msg += '\n\nHá ' + n + ' reserva(s) ativa(s) vinculada(s) a este quarto — continuam no sistema, mas o quarto some do catálogo.';
    }
    if (!window.confirm(msg)) return;
    SystemStore.apagarQuartoCatalog(id)
      .then(function () {
        closeQuartoEditorModal();
        renderAll();
      })
      .catch(function (err) {
        console.error(err);
        alert('Não foi possível apagar o quarto.');
      });
  }

  function handleQuartoEditorSubmit() {
    if (!SystemStore.salvarQuartoCatalog) {
      alert('Salvar indisponível.');
      return;
    }
    var idEl = document.getElementById('qua-id');
    var tituloEl = document.getElementById('qua-titulo');
    if (!idEl || !tituloEl) return;
    var rawId = String(idEl.value || '').trim();
    if (!rawId) {
      alert('Informe o identificador do quarto.');
      return;
    }
    var list = window.QUARTOS_SITE || [];
    var existing = list.find(function (x) { return String(x.id) === String(rawId); });
    var ordemEl = document.getElementById('qua-ordem');
    var payload = {
      id: rawId,
      titulo: String(tituloEl.value || '').trim(),
      tipo: String((document.getElementById('qua-tipo') && document.getElementById('qua-tipo').value) || '').trim(),
      desc: String((document.getElementById('qua-desc') && document.getElementById('qua-desc').value) || '')
        .trim()
        .substring(0, getQuartoDescMaximo()),
      capacidade: Math.max(1, Math.floor(Number(document.getElementById('qua-cap').value) || 1)),
      preco: String((document.getElementById('qua-preco') && document.getElementById('qua-preco').value) || '').trim() || 'R$ 0',
      precoLabel: String(
        (document.getElementById('qua-preco-label') && document.getElementById('qua-preco-label').value) || 'Noite'
      ).trim() || 'Noite',
      img: String((document.getElementById('qua-img') && document.getElementById('qua-img').value) || '').trim(),
      alt: String((document.getElementById('qua-alt') && document.getElementById('qua-alt').value) || '').trim()
    };
    var baseA = existing && existing.amenities && typeof existing.amenities === 'object' ? Object.assign({}, existing.amenities) : {};
    QUARTO_AMENITY_OPTS.forEach(function (opt) {
      var el = document.getElementById('qua-am-' + opt.key);
      baseA[opt.key] = !!(el && el.checked);
    });
    baseA.camasCasal = Math.max(0, Math.floor(Number(document.getElementById('qua-camas-casal').value) || 0));
    baseA.camasSolteiro = Math.max(0, Math.floor(Number(document.getElementById('qua-camas-solteiro').value) || 0));
    var m2 = document.getElementById('qua-m2').value;
    if (m2 !== '' && !isNaN(Number(m2))) baseA.metros2 = Math.max(0, Math.floor(Number(m2)));
    else delete baseA.metros2;
    var extraRaw = (document.getElementById('qua-imagens-extra') && document.getElementById('qua-imagens-extra').value) || '';
    var extraLines = extraRaw
      .split('\n')
      .map(function (s) {
        return String(s || '').trim();
      })
      .filter(Boolean);
    if (extraLines.length) baseA.galeria = extraLines;
    else delete baseA.galeria;
    payload.amenities = baseA;
    if (ordemEl && ordemEl.value !== '' && !isNaN(Number(ordemEl.value))) {
      payload.ordem = Math.floor(Number(ordemEl.value));
    }
    SystemStore.salvarQuartoCatalog(payload)
      .then(function () {
        closeQuartoEditorModal();
        renderAll();
      })
      .catch(function (err) {
        console.error(err);
        alert('Não foi possível salvar o quarto.');
      });
  }

  function renderQuartos() {
    var el = document.getElementById('tab-quartos');
    if (!el) return;
    var list = window.QUARTOS_SITE && window.QUARTOS_SITE.length ? window.QUARTOS_SITE : [];
    var sem = countReservasAtivasSemQuarto();
    var avisoSem =
      sem > 0
        ? '<p class="sys-help sys-quartos-aviso">' +
          esc(String(sem)) +
          ' reserva(s) ativa(s) sem quarto específico — no calendário ocupam o imóvel inteiro (todos os quartos).</p>'
        : '';
    var toolbar =
      '<div class="sys-quartos-toolbar">' +
      '<button type="button" class="sys-btn" id="btn-quarto-novo">+ Novo quarto</button>' +
      '<span class="sys-help">Descrição: no máximo ' +
      esc(String(getQuartoDescMaximo())) +
      ' caracteres.</span>' +
      '</div>';
    var cards = list
      .map(function (q) {
        var n = countReservasAtivasNoQuarto(q.id);
        var hrefSite = esc(q.verQuartoHref || 'quartos.html');
        var hrefRes = esc('reservar.html?quarto=' + encodeURIComponent(q.id));
        var imgPath = imagemPrincipalQuartoSite(q);
        var media =
          '<figure class="sys-quarto-media' +
          (imgPath === '' ? ' sys-quarto-media--empty' : '') +
          '">' +
          (imgPath !== ''
            ? '<img src="' +
              esc(imgPath) +
              '" alt="' +
              esc(q.alt || q.titulo || 'Quarto') +
              '" loading="lazy" decoding="async" />'
            : '') +
          '</figure>';
        return (
          '<article class="sys-card sys-quarto-card">' +
          media +
          '<div class="sys-quarto-body">' +
          '<div class="sys-quarto-card-head">' +
          '<h3>' +
          esc(q.titulo) +
          '</h3>' +
          '<span class="sys-quarto-id">' +
          esc(q.id) +
          '</span></div>' +
          '<p class="sys-quarto-tipo">' +
          esc(q.tipo || '') +
          '</p>' +
          '<p class="sys-help sys-quarto-desc">' +
          esc(q.desc || '') +
          '</p>' +
          '<ul class="sys-quarto-meta">' +
          '<li><strong>Capacidade:</strong> até ' +
          esc(String(q.capacidade != null ? q.capacidade : '—')) +
          ' pessoas</li>' +
          '<li><strong>Valor no site:</strong> ' +
          esc(q.preco || '—') +
          ' / ' +
          esc(q.precoLabel || 'noite') +
          '</li>' +
          '<li><strong>Reservas ativas neste quarto:</strong> ' +
          esc(String(n)) +
          '</li></ul>' +
          '<div class="sys-quarto-links">' +
          '<a class="sys-btn sys-btn--ghost" href="' +
          hrefSite +
          '" target="_blank" rel="noopener noreferrer">Ver no site</a>' +
          '<a class="sys-btn sys-btn--ghost" href="' +
          hrefRes +
          '" target="_blank" rel="noopener noreferrer">Página reservar</a>' +
          '</div>' +
          '<div class="sys-quarto-admin">' +
          '<button type="button" class="sys-btn sys-btn--small" data-quarto-edit="' +
          esc(q.id) +
          '">Editar</button>' +
          '<button type="button" class="sys-btn sys-btn--small sys-btn--danger" data-quarto-delete="' +
          esc(q.id) +
          '">Apagar quarto</button>' +
          '</div></div></article>'
        );
      })
      .join('');
    el.innerHTML =
      '<h2 class="sys-section-title">Quartos</h2>' +
      toolbar +
      avisoSem +
      (cards
        ? '<div class="sys-quartos-grid">' + cards + '</div>'
        : '<p class="sys-help">Nenhum quarto na lista. Use «Novo quarto».</p>');
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
    var bloqueios = SystemStore.getBloqueios();
    return (
      '<div class="sys-config-bloqueios">' +
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
      '</article></div>'
    );
  }

  function bindEvents() {
    var mobileToggle = document.getElementById('sys-mobile-toggle');
    var logoutBtn = document.getElementById('btn-logout');
    var headerSearchForm = document.getElementById('app-header-search-form');
    if (headerSearchForm) {
      headerSearchForm.addEventListener('submit', function (ev) {
        ev.preventDefault();
        executeHeaderSearch();
      });
    }
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
          await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
          if ('serviceWorker' in navigator) {
            var regs = await navigator.serviceWorker.getRegistrations();
            regs.forEach(function (r) {
              r.unregister();
            });
          }
        } catch (e) {}
        window.location.href = 'login.html';
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
      if (ev.target.closest && ev.target.closest('[data-quarto-modal-close]')) {
        closeQuartoEditorModal();
        return;
      }
      if (ev.target.id === 'btn-quarto-novo' || (ev.target.closest && ev.target.closest('#btn-quarto-novo'))) {
        openQuartoEditor(null);
        return;
      }
      var elEditQuarto = ev.target.closest && ev.target.closest('[data-quarto-edit]');
      if (elEditQuarto) {
        openQuartoEditor(elEditQuarto.getAttribute('data-quarto-edit'));
        return;
      }
      var elDelQuarto = ev.target.closest && ev.target.closest('[data-quarto-delete]');
      if (elDelQuarto) {
        tryDeleteQuarto(elDelQuarto.getAttribute('data-quarto-delete'));
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
            alert('Nao foi possivel cancelar a reserva.');
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
        renderHistorico();
      } else if (ev.target.classList.contains('sys-ficha-search-input')) {
        var cursorPos = ev.target.selectionStart;
        var activeId = ev.target.id;
        state.fichaQuery = ev.target.value;
        syncHeaderSearchInput(state.fichaQuery);
        if (state.tab === 'ficha') {
          renderFicha();
          var input = document.getElementById(activeId);
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
      } else if (ev.target.classList.contains('sys-ficha-status-select')) {
        if (ev.target.id === 'modal-reserva-status' && SystemStore.atualizarStatusReserva) {
          var rid = ev.target.getAttribute('data-reserva-id');
          var novoStatus = ev.target.value;
          if (rid && novoStatus) {
            SystemStore.atualizarStatusReserva(rid, novoStatus)
              .then(function () {
                renderAll();
                openModal(rid);
              })
              .catch(function () {
                alert('Não foi possível atualizar o status.');
              });
          }
          return;
        }
        state.fichaStatus = ev.target.value;
        if (state.tab === 'ficha') renderFicha();
      }
    });

    document.body.addEventListener('submit', function (ev) {
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
      if (ev.target.id === 'form-quarto-editor') {
        ev.preventDefault();
        handleQuartoEditorSubmit();
      }
    });
  }

  function openModal(id) {
    var reserva = SystemStore.getReservas().find(function (r) {
      return r.id === id;
    });
    if (!reserva) return;
    var st = String(reserva.status || 'pendente').toLowerCase();
    if (st === 'ativa') st = 'confirmada';
    var card = document.getElementById('reserva-modal-card');
    card.innerHTML =
      '<div class="sys-ficha-detalhe">' +
      '<h2 class="sys-ficha-detalhe__title">Reserva #' +
      esc(reserva.codigo) +
      '</h2>' +
      '<div class="sys-ficha-detalhe__grid">' +
      field('status', statusLabelReserva(reserva.status)) +
      field('nome', reserva.nome) +
      field('quarto', quartoTituloPorIdPainel(reserva.quartoId)) +
      field('entrada', fmtDate(reserva.dataEntrada)) +
      field('saída', fmtDate(reserva.dataSaida)) +
      field('noites', noitesReservaTexto(reserva)) +
      field('adultos', reserva.adultos != null ? reserva.adultos : reserva.pessoas) +
      field('crianças', reserva.criancas != null ? reserva.criancas : 0) +
      field('gmail', reserva.email) +
      field('telefone', reserva.telefone) +
      field('valor adicional', money(reserva.valorAdicional)) +
      field('valor total', valorReservaTexto(reserva)) +
      field('data da solicitação', fmtDateTime(reserva.criadoEm)) +
      field('plataforma', (reserva.plataforma || 'site').toUpperCase()) +
      field('método', formatMetodoPagamento(reserva.metodoPagamento), true) +
      '</div>' +
      (reserva.status === 'cancelada'
        ? ''
        : '<label class="sys-ficha-status-wrap sys-ficha-detalhe__status-edit"><span>Alterar status</span><select id="modal-reserva-status" class="sys-ficha-status-select" data-reserva-id="' +
          esc(reserva.id) +
          '"><option value="pendente"' +
          (st === 'pendente' ? ' selected' : '') +
          '>Pendente</option><option value="confirmada"' +
          (st === 'confirmada' ? ' selected' : '') +
          '>Confirmada</option><option value="cancelada"' +
          (st === 'cancelada' ? ' selected' : '') +
          '>Cancelada</option></select></label>') +
      '<div class="sys-ficha-detalhe__actions">' +
      (reserva.status === 'cancelada'
        ? '<button type="button" class="sys-ficha-detalhe__btn sys-ficha-detalhe__btn--muted" disabled>reserva cancelada</button>'
        : '<button type="button" class="sys-ficha-detalhe__btn sys-ficha-detalhe__btn--danger" data-cancel-reserva="' +
          esc(reserva.id) +
          '">cancelar reserva</button>') +
      '<button type="button" class="sys-ficha-detalhe__btn sys-ficha-detalhe__btn--primary" data-close-modal="true">fechar</button></div></div>';
    document.getElementById('reserva-modal').hidden = false;
  }

  function field(label, value, fullWidth) {
    var fw = fullWidth ? ' sys-ficha-detalhe__field--full' : '';
    return (
      '<div class="sys-ficha-detalhe__field' +
      fw +
      '"><span class="sys-ficha-detalhe__label">' +
      esc(label) +
      '</span><span class="sys-ficha-detalhe__value">' +
      esc(value) +
      '</span></div>'
    );
  }

  function formatMetodoPagamento(metodo) {
    var key = String(metodo || 'pix').toLowerCase();
    var map = {
      whatsapp: 'WhatsApp',
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
    try {
      renderFaturamento();
    } catch (e) {
      console.error('renderFaturamento', e);
    }
    try {
      renderFicha();
    } catch (e) {
      console.error('renderFicha', e);
    }
    try {
      renderHistorico();
    } catch (e) {
      console.error('renderHistorico', e);
    }
    try {
      renderCalendario();
    } catch (e) {
      console.error('renderCalendario', e);
    }
    try {
      renderQuartos();
    } catch (e) {
      console.error('renderQuartos', e);
    }
    try {
      setActiveTab(state.tab);
    } catch (e) {
      console.error('setActiveTab', e);
    }
  }

  bindEvents();
  renderAll();

  function enablePwaAfterAuth() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(function () {});
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
    enablePwaAfterAuth();
    try {
      var publicCfg = {};
      try {
        var cfgRes = await fetch('/api/config/public');
        if (cfgRes.ok) publicCfg = await cfgRes.json();
      } catch (eCfg) {}
      if (!publicCfg.disablePanelAuth) {
        var me = await fetch('/api/auth/me', { credentials: 'include' });
        if (!me.ok) {
          window.location.href =
            '/login.html?next=' + encodeURIComponent(window.location.pathname || '/painel.html');
          return;
        }
      }
      if (window.carregarImagensQuartosPastas) await window.carregarImagensQuartosPastas();
      if (SystemStore.hydrateQuartosSite) await SystemStore.hydrateQuartosSite();
      if (SystemStore.init) await SystemStore.init();
    } catch (errBoot) {
      console.error('Falha ao carregar painel:', errBoot);
      alert('Nao foi possivel carregar dados do servidor.');
    }
    renderAll();
  })();
})();
