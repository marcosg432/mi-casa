'use strict';

(function () {
  var POLL_MS = 12000;
  var pollTimer = null;
  var HORARIOS = [];
  for (var h = 11; h <= 22; h++) {
    HORARIOS.push(String(h).padStart(2, '0') + ':00');
    if (h < 22) HORARIOS.push(String(h).padStart(2, '0') + ':30');
  }

  function $(id) { return document.getElementById(id); }

  function hojeISO() {
    var now = new Date();
    return (
      String(now.getFullYear()) + '-' +
      String(now.getMonth() + 1).padStart(2, '0') + '-' +
      String(now.getDate()).padStart(2, '0')
    );
  }

  function calcMesas(pessoas) {
    var p = Math.max(1, Math.min(16, parseInt(pessoas, 10) || 1));
    if (p <= 4) return 1;
    if (p <= 8) return 2;
    if (p <= 12) return 3;
    return 4;
  }

  function formatDataBR(iso) {
    if (!iso) return '—';
    var p = String(iso).slice(0, 10).split('-');
    return p[2] + '/' + p[1] + '/' + p[0];
  }

  function statusLabel(st) {
    if (st === 'confirmada') return 'Confirmada';
    if (st === 'pendente') return 'Pendente';
    if (st === 'cancelada') return 'Cancelada';
    return st;
  }

  function mesaStatusLabel(st) {
    if (st === 'ocupada') return 'Ocupada';
    if (st === 'pendente') return 'Pendente';
    if (st === 'bloqueada') return 'Bloqueada';
    return 'Disponível';
  }

  function api(path, opts) {
    opts = opts || {};
    return fetch('/api/admin' + path, {
      method: opts.method || 'GET',
      credentials: 'include',
      headers: Object.assign(
        { 'Content-Type': 'application/json' },
        opts.headers || {}
      ),
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function (res) {
      if (res.status === 401) {
        window.location.href = '/login.html?next=' + encodeURIComponent('/painel-mesas.html');
        throw new Error('Não autenticado.');
      }
      return res.json().then(function (data) {
        if (!res.ok) throw new Error(data.error || 'Erro na requisição.');
        return data;
      });
    });
  }

  function getFiltros() {
    return {
      data: ($('pm-data') && $('pm-data').value) || hojeISO(),
      periodo: ($('pm-periodo') && $('pm-periodo').value) || 'dia'
    };
  }

  function renderCards(totais) {
    $('pm-total-mesas').textContent = totais.mesas;
    $('pm-disp-mesas').textContent = totais.disponiveis;
    $('pm-ocupadas').textContent =
      totais.mesasReservadas != null ? totais.mesasReservadas : totais.ocupadas + totais.pendentes;
    $('pm-reservas-hoje').textContent = totais.reservasHoje;
  }

  function renderAviso(data) {
    var el = $('pm-aviso');
    if (!el) return;
    if (!data.aviso || !data.datasComReserva || !data.datasComReserva.length) {
      el.hidden = true;
      el.innerHTML = '';
      return;
    }
    el.hidden = false;
    el.innerHTML =
      '<p>' + escapeHtml(data.aviso) + '</p>' +
      '<div class="pm-aviso-btns">' +
      data.datasComReserva.map(function (d) {
        return (
          '<button type="button" class="pm-aviso-data" data-iso="' + escapeHtml(d.iso) + '">' +
          escapeHtml(d.br) + ' (' + d.total + ')</button>'
        );
      }).join('') +
      '</div>';
    el.querySelectorAll('.pm-aviso-data').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var dataInput = $('pm-data');
        if (dataInput) dataInput.value = btn.getAttribute('data-iso');
        carregarDashboard();
      });
    });
  }

  function renderTabela(reservas) {
    var tbody = $('pm-reservas-body');
    if (!tbody) return;
    if (!reservas.length) {
      tbody.innerHTML =
        '<tr><td colspan="6" class="pm-vazio">Nenhuma reserva para os filtros selecionados.</td></tr>';
      return;
    }

    tbody.innerHTML = reservas
      .map(function (r) {
        return (
          '<tr data-id="' + r.id + '">' +
          '<td>' + r.horario + '</td>' +
          '<td><strong>' + escapeHtml(r.nome) + '</strong><br><small>' + escapeHtml(r.telefone) + '</small></td>' +
          '<td>' + r.pessoas + ' pessoas</td>' +
          '<td><span class="pm-tag pm-tag--mesas">' + r.mesasUtilizadas + ' mesa(s)</span></td>' +
          '<td><span class="pm-tag pm-tag--' + r.status + '">' + statusLabel(r.status) + '</span></td>' +
          '<td><div class="pm-acoes">' +
          (r.status !== 'confirmada'
            ? '<button type="button" class="pm-acao" data-acao="confirmar">Confirmar</button>'
            : '') +
          (r.status !== 'cancelada'
            ? '<button type="button" class="pm-acao" data-acao="cancelar">Cancelar</button>'
            : '') +
          '<button type="button" class="pm-acao" data-acao="mesas">Mesas</button>' +
          '</div></td>' +
          '</tr>'
        );
      })
      .join('');
  }

  function renderMapa(mapa) {
    var grid = $('pm-mesas-grid');
    if (!grid) return;
    grid.innerHTML = mapa
      .map(function (m) {
        return (
          '<div class="pm-mesa pm-mesa--' + m.status + '" data-mesa-id="' + m.id + '">' +
          '<div class="pm-mesa-num">Mesa ' + m.numero + '</div>' +
          '<div class="pm-mesa-status">' + mesaStatusLabel(m.status) + '</div>' +
          '<div class="pm-mesa-acoes">' +
          (m.status === 'bloqueada'
            ? '<button type="button" class="pm-acao" data-mesa-acao="liberar">Liberar</button>'
            : '<button type="button" class="pm-acao" data-mesa-acao="bloquear">Bloquear</button>') +
          '</div></div>'
        );
      })
      .join('');
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function mostrarErro(msg) {
    var el = $('pm-erro');
    if (!el) return;
    if (msg) {
      el.textContent = msg;
      el.hidden = false;
    } else {
      el.hidden = true;
    }
  }

  function carregarDashboard() {
    var f = getFiltros();
    var qs =
      '?data=' + encodeURIComponent(f.data) + '&periodo=' + encodeURIComponent(f.periodo);
    return api('/mesas/dashboard' + qs)
      .then(function (data) {
        renderCards(data.totais);
        renderTabela(data.reservas);
        renderMapa(data.mapa);
        renderAviso(data);
        mostrarErro(null);
      })
      .catch(function (e) {
        mostrarErro(e.message);
      });
  }

  function patchReserva(id, body) {
    return api('/mesas/reservas/' + id, { method: 'PATCH', body: body }).then(function () {
      return carregarDashboard();
    });
  }

  function patchMesa(id, statusManual) {
    return api('/mesas/' + id + '/status', {
      method: 'PATCH',
      body: { statusManual: statusManual }
    }).then(function () {
      return carregarDashboard();
    });
  }

  function onTabelaClick(ev) {
    var btn = ev.target.closest('[data-acao]');
    if (!btn) return;
    var tr = btn.closest('tr');
    if (!tr) return;
    var id = tr.getAttribute('data-id');
    var acao = btn.getAttribute('data-acao');

    if (acao === 'confirmar') {
      patchReserva(id, { status: 'confirmada' }).catch(function (e) {
        mostrarErro(e.message);
      });
      return;
    }
    if (acao === 'cancelar') {
      if (!window.confirm('Cancelar esta reserva?')) return;
      patchReserva(id, { status: 'cancelada' }).catch(function (e) {
        mostrarErro(e.message);
      });
      return;
    }
    if (acao === 'mesas') {
      var val = window.prompt('Quantas mesas esta reserva utiliza? (1 a 10)');
      if (val == null) return;
      var n = parseInt(val, 10);
      if (isNaN(n) || n < 1 || n > 10) {
        mostrarErro('Informe um número entre 1 e 10.');
        return;
      }
      patchReserva(id, { mesasUtilizadas: n }).catch(function (e) {
        mostrarErro(e.message);
      });
    }
  }

  function onMapaClick(ev) {
    var btn = ev.target.closest('[data-mesa-acao]');
    if (!btn) return;
    var card = btn.closest('[data-mesa-id]');
    if (!card) return;
    var id = card.getAttribute('data-mesa-id');
    var acao = btn.getAttribute('data-mesa-acao');
    var status = acao === 'bloquear' ? 'bloqueada' : 'disponivel';
    patchMesa(id, status).catch(function (e) {
      mostrarErro(e.message);
    });
  }

  function logout() {
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).finally(function () {
      window.location.href = '/login.html?next=' + encodeURIComponent('/painel-mesas.html');
    });
  }

  function popularHorariosNova() {
    var sel = $('pm-nova-horario');
    if (!sel) return;
    sel.innerHTML = HORARIOS.map(function (h) {
      return '<option value="' + h + '">' + h + '</option>';
    }).join('');
  }

  function syncMesasNova() {
    var pessoas = $('pm-nova-pessoas');
    var mesas = $('pm-nova-mesas');
    if (pessoas && mesas) mesas.value = String(calcMesas(pessoas.value));
  }

  function criarReservaManual(ev) {
    if (ev) ev.preventDefault();
    var f = getFiltros();
    var nome = ($('pm-nova-nome') && $('pm-nova-nome').value.trim()) || '';
    var telefone = ($('pm-nova-telefone') && $('pm-nova-telefone').value.trim()) || 'Painel admin';
    var horario = $('pm-nova-horario') && $('pm-nova-horario').value;
    var pessoas = parseInt($('pm-nova-pessoas') && $('pm-nova-pessoas').value, 10) || 0;
    var mesas = parseInt($('pm-nova-mesas') && $('pm-nova-mesas').value, 10) || 0;

    if (nome.length < 2) {
      mostrarErro('Informe o nome do cliente.');
      return;
    }
    if (!horario) {
      mostrarErro('Selecione o horário.');
      return;
    }

    var btn = $('pm-nova-submit');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Salvando…';
    }

    api('/mesas/reservas', {
      method: 'POST',
      body: {
        data: f.data,
        horario: horario,
        pessoas: pessoas,
        mesasUtilizadas: mesas,
        nome: nome,
        telefone: telefone,
        status: 'confirmada'
      }
    })
      .then(function () {
        if ($('pm-nova-nome')) $('pm-nova-nome').value = '';
        if ($('pm-nova-telefone')) $('pm-nova-telefone').value = '';
        syncMesasNova();
        mostrarErro(null);
        return carregarDashboard();
      })
      .catch(function (e) {
        mostrarErro(e.message);
      })
      .finally(function () {
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Reservar mesa';
        }
      });
  }

  function iniciarPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(carregarDashboard, POLL_MS);
  }

  function init() {
    var dataInput = $('pm-data');
    if (dataInput) dataInput.value = hojeISO();

    popularHorariosNova();
    syncMesasNova();

    $('pm-aplicar') && $('pm-aplicar').addEventListener('click', carregarDashboard);
    $('pm-data') && $('pm-data').addEventListener('change', carregarDashboard);
    $('pm-periodo') && $('pm-periodo').addEventListener('change', carregarDashboard);
    $('pm-sair') && $('pm-sair').addEventListener('click', logout);
    $('pm-reservas-body') && $('pm-reservas-body').addEventListener('click', onTabelaClick);
    $('pm-mesas-grid') && $('pm-mesas-grid').addEventListener('click', onMapaClick);
    $('pm-nova-form') && $('pm-nova-form').addEventListener('submit', criarReservaManual);
    $('pm-nova-pessoas') && $('pm-nova-pessoas').addEventListener('input', syncMesasNova);

    carregarDashboard();
    iniciarPolling();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
