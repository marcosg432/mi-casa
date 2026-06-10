'use strict';

(function () {
  var POLL_MS = 15000;
  var pollTimer = null;
  var WHATS_ICON_SVG =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path fill="currentColor" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>' +
    '</svg>';
  var TOTAL_MESAS = 10;
  var MAX_PESSOAS = 16;
  var HORARIOS = [];
  var horariosDispCache = null;
  for (var hi = 11; hi <= 22; hi++) {
    HORARIOS.push(String(hi).padStart(2, '0') + ':00');
    if (hi < 22) HORARIOS.push(String(hi).padStart(2, '0') + ':30');
  }

  function $(id) { return document.getElementById(id); }

  function calcMesas(pessoas) {
    var p = Math.max(1, Math.min(MAX_PESSOAS, parseInt(pessoas, 10) || 0));
    if (p <= 4) return 1;
    if (p <= 8) return 2;
    if (p <= 12) return 3;
    return 4;
  }

  function formatDataBR(iso) {
    if (!iso) return '—';
    if (/^\d{2}\/\d{2}$/.test(iso)) return iso;
    var p = String(iso).slice(0, 10).split('-');
    if (p.length === 3) return p[2] + '/' + p[1];
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(iso)) return iso.slice(0, 5);
    return iso;
  }

  function formatDataCompleta(iso) {
    if (!iso) return '—';
    var p = String(iso).slice(0, 10).split('-');
    if (p.length !== 3) return formatDataBR(iso);
    return p[2] + '/' + p[1] + '/' + p[0];
  }

  function formatPessoas(n) {
    var p = parseInt(n, 10);
    if (!p) return '—';
    return p + (p === 1 ? ' pessoa' : ' pessoas');
  }

  function hojeISO() {
    var now = new Date();
    return (
      String(now.getFullYear()) + '-' +
      String(now.getMonth() + 1).padStart(2, '0') + '-' +
      String(now.getDate()).padStart(2, '0')
    );
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

  function mascaraData(val) {
    var d = String(val || '').replace(/\D/g, '').slice(0, 4);
    if (d.length <= 2) return d;
    return d.slice(0, 2) + '/' + d.slice(2);
  }

  function mascaraHorario(val) {
    var d = String(val || '').replace(/\D/g, '').slice(0, 4);
    if (d.length <= 2) return d;
    return d.slice(0, 2) + ':' + d.slice(2);
  }

  function mascaraPessoas(val) {
    var d = String(val || '').replace(/\D/g, '').slice(0, 2);
    if (!d) return '';
    var n = parseInt(d, 10);
    if (n > MAX_PESSOAS) return String(MAX_PESSOAS);
    return d;
  }

  function mascaraTelefone(val) {
    var d = String(val || '').replace(/\D/g, '').slice(0, 11);
    if (d.length <= 2) return d ? '(' + d : '';
    if (d.length <= 7) return '(' + d.slice(0, 2) + ') ' + d.slice(2);
    if (d.length <= 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
    return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
  }

  function parseDataBRparaISO(br) {
    var s = String(br || '').trim();
    var mFull = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (mFull) {
      return isoFromParts(parseInt(mFull[1], 10), parseInt(mFull[2], 10), parseInt(mFull[3], 10));
    }
    var m = s.match(/^(\d{2})\/(\d{2})$/);
    if (!m) return null;
    var dd = parseInt(m[1], 10);
    var mm = parseInt(m[2], 10);
    var yyyy = new Date().getFullYear();
    var iso = isoFromParts(dd, mm, yyyy);
    if (!iso) return null;
    if (iso < hojeISO()) {
      iso = isoFromParts(dd, mm, yyyy + 1);
    }
    return iso;
  }

  function isoFromParts(dd, mm, yyyy) {
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
    var iso =
      String(yyyy) + '-' + String(mm).padStart(2, '0') + '-' + String(dd).padStart(2, '0');
    var dt = new Date(iso + 'T12:00:00');
    if (isNaN(dt.getTime())) return null;
    if (dt.getFullYear() !== yyyy || dt.getMonth() + 1 !== mm || dt.getDate() !== dd) return null;
    return iso;
  }

  function parseHorarioValido(raw) {
    var s = String(raw || '').trim();
    if (!s) return null;
    if (!horarioPermitido(s)) return null;
    return s;
  }

  function mesasNecessariasAtual() {
    var st = getFormState();
    if (st.pessoas >= 1 && st.pessoas <= MAX_PESSOAS) return calcMesas(st.pessoas);
    return 1;
  }

  function popularSelectHorarios(lista) {
    var sel = $('mesa-horario');
    if (!sel) return;
    var atual = sel.value;
    var dispMap = {};
    if (lista && lista.length) {
      lista.forEach(function (item) {
        dispMap[item.horario] = item.disponiveis;
      });
    }
    var mesasNec = mesasNecessariasAtual();
    sel.innerHTML = '<option value="">Selecione o horário</option>';
    HORARIOS.forEach(function (h) {
      var opt = document.createElement('option');
      opt.value = h;
      var disp = dispMap[h];
      if (Number.isFinite(Number(disp)) && Number(disp) < mesasNec) {
        opt.disabled = true;
        opt.textContent = h + ' (lotado)';
      } else {
        opt.textContent = h;
      }
      sel.appendChild(opt);
    });
    if (atual && sel.querySelector('option[value="' + atual + '"]:not([disabled])')) {
      sel.value = atual;
    } else if (atual && sel.querySelector('option[value="' + atual + '"][disabled]')) {
      sel.value = '';
    }
  }

  function onDataChange() {
    var dataBR = $('mesa-data') && $('mesa-data').value.trim();
    var iso = parseDataBRparaISO(dataBR);
    if (iso) {
      atualizarHorariosSelect();
    } else {
      horariosDispCache = null;
      popularSelectHorarios(null);
    }
    atualizarDisponibilidadeAgora();
  }

  function atualizarHorariosSelect() {
    var st = getFormState();
    if (!st.data) {
      horariosDispCache = null;
      popularSelectHorarios(null);
      return;
    }
    fetch('/api/mesas/horarios?data=' + encodeURIComponent(st.data), { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        horariosDispCache = data.horarios || null;
        popularSelectHorarios(horariosDispCache);
      })
      .catch(function () {
        horariosDispCache = null;
        popularSelectHorarios(null);
      });
  }

  function getFormState() {
    var dataBR = $('mesa-data') && $('mesa-data').value.trim();
    var horarioRaw = $('mesa-horario') && $('mesa-horario').value.trim();
    var pessoasRaw = $('mesa-pessoas') && $('mesa-pessoas').value.trim();
    return {
      data: parseDataBRparaISO(dataBR),
      dataBR: dataBR,
      horario: parseHorarioValido(horarioRaw),
      horarioDisplay: horarioRaw,
      pessoas: parseInt(pessoasRaw, 10) || 0,
      nome: $('mesa-nome') && $('mesa-nome').value.trim(),
      telefone: $('mesa-telefone') && $('mesa-telefone').value.trim()
    };
  }

  function atualizarResumo() {
    var st = getFormState();
    var mesasNec = st.pessoas >= 1 && st.pessoas <= MAX_PESSOAS ? calcMesas(st.pessoas) : null;
    $('resumo-data').textContent = st.data ? formatDataBR(st.data) : (st.dataBR || '—');
    $('resumo-horario').textContent = st.horario || st.horarioDisplay || '—';
    $('resumo-pessoas').textContent = st.pessoas ? formatPessoas(st.pessoas) : '—';
    $('resumo-mesas').textContent = mesasNec ? mesasNec + (mesasNec === 1 ? ' mesa' : ' mesas') : '—';

    var dispEl = $('resumo-disp-apos');
    var placeholder = $('resumo-placeholder');
    if (st.data && st.horario && mesasNec) {
      fetchDisponibilidade(st.data, st.horario).then(function (info) {
        var restante = Math.max(0, info.disponiveis - mesasNec);
        if (dispEl) dispEl.textContent = restante + ' de ' + info.total;
        if (placeholder) placeholder.hidden = true;
      });
    } else {
      if (dispEl) dispEl.textContent = '—';
      if (placeholder) placeholder.hidden = false;
    }
  }

  function getContextoDisponibilidade() {
    var st = getFormState();
    if (st.data && st.horario) {
      return { data: st.data, horario: st.horario };
    }
    return { data: hojeISO(), horario: null };
  }

  function renderDispAgora(disponiveis, total) {
    var el = $('mesa-disp-agora');
    if (!el) return;
    var disp = Number.isFinite(Number(disponiveis)) ? Number(disponiveis) : TOTAL_MESAS;
    var tot = Number.isFinite(Number(total)) ? Number(total) : TOTAL_MESAS;
    el.innerHTML = '<span>' + disp + '</span> mesas';
  }

  function normalizarDisponibilidade(info) {
    if (!info || info.error) {
      return { disponiveis: TOTAL_MESAS, total: TOTAL_MESAS };
    }
    return {
      disponiveis: Number.isFinite(Number(info.disponiveis)) ? Number(info.disponiveis) : TOTAL_MESAS,
      total: Number.isFinite(Number(info.total)) ? Number(info.total) : TOTAL_MESAS
    };
  }

  function fetchDisponibilidade(data, horario) {
    var url = '/api/mesas/disponibilidade';
    var qs = [];
    if (data) qs.push('data=' + encodeURIComponent(data));
    if (horario) qs.push('horario=' + encodeURIComponent(horario));
    if (qs.length) url += '?' + qs.join('&');
    return fetch(url, { cache: 'no-store' })
      .then(function (r) {
        return r.json().then(function (info) {
          if (!r.ok) return normalizarDisponibilidade(null);
          return normalizarDisponibilidade(info);
        });
      })
      .catch(function () { return normalizarDisponibilidade(null); });
  }

  function atualizarDisponibilidadeAgora() {
    var ctx = getContextoDisponibilidade();
    return fetchDisponibilidade(ctx.data, ctx.horario).then(function (info) {
      renderDispAgora(info.disponiveis, info.total);
      return info;
    });
  }

  function validarFormulario(st) {
    if (!st.dataBR) return 'Informe a data.';
    if (!st.data) return 'Informe uma data válida (DD/MM).';
    if (st.data < hojeISO()) return 'A data deve ser hoje ou futura.';
    if (!st.horarioDisplay) return 'Selecione o horário.';
    if (!st.horario) return 'Selecione um horário válido (entre 11:00 e 22:00).';
    if (!st.pessoas) return 'Informe a quantidade de pessoas.';
    if (st.pessoas < 1 || st.pessoas > MAX_PESSOAS) {
      return 'Informe de 1 a ' + MAX_PESSOAS + ' pessoas.';
    }
    if (st.nome.length < 2) return 'Informe seu nome.';
    if (st.telefone.replace(/\D/g, '').length < 10) return 'Informe um telefone válido.';
    return null;
  }

  function mostrarErro(msg) {
    var el = $('mesa-erro');
    if (!el) return;
    if (msg) {
      el.textContent = msg;
      el.hidden = false;
    } else {
      el.hidden = true;
      el.textContent = '';
    }
  }

  function mesasDaReserva(reserva) {
    var m = reserva.mesasUtilizadas != null ? reserva.mesasUtilizadas : reserva.mesas_utilizadas;
    if (Number.isFinite(Number(m)) && Number(m) > 0) return Number(m);
    return calcMesas(reserva.pessoas);
  }

  function abrirWhatsApp(reserva) {
    var mesas = mesasDaReserva(reserva);
    var msg =
      'Olá, quero fazer uma reserva de mesa.\n\n' +
      'Data: ' + formatDataCompleta(reserva.data) + '\n' +
      'Horário: ' + reserva.horario + '\n' +
      'Quantidade de pessoas: ' + reserva.pessoas + '\n' +
      'Quantidade de mesas: ' + mesas + '\n' +
      'Nome: ' + reserva.nome + '\n' +
      'Telefone: ' + reserva.telefone;
    var url =
      (window.MiCasaContato && window.MiCasaContato.buildWhatsAppUrl)
        ? window.MiCasaContato.buildWhatsAppUrl(msg)
        : 'https://wa.me/559180781514?text=' + encodeURIComponent(msg);
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function finalizarReservaWhatsApp(payload) {
    abrirWhatsApp(payload);
    onDataChange();
    atualizarDisponibilidadeAgora();
    atualizarResumo();
    mostrarErro(null);
  }

  function enviarReserva() {
    var st = getFormState();
    var erro = validarFormulario(st);
    if (erro) {
      mostrarErro(erro);
      return;
    }
    mostrarErro(null);
    var btn = $('mesa-btn-reservar');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Registrando…';
    }

    var payload = {
      data: st.data,
      horario: st.horario,
      pessoas: st.pessoas,
      mesasUtilizadas: calcMesas(st.pessoas),
      nome: st.nome,
      telefone: st.telefone
    };

    fetch('/api/mesas/reservas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (r) {
        return r.json().then(function (data) {
          if (!r.ok) {
            var err = new Error(data.error || 'Não foi possível registrar a reserva.');
            err.status = r.status;
            throw err;
          }
          return data;
        });
      })
      .then(finalizarReservaWhatsApp)
      .catch(function (e) {
        mostrarErro((e && e.message) || 'Erro ao reservar. Tente novamente.');
      })
      .finally(function () {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = WHATS_ICON_SVG + ' Reservar pelo WhatsApp';
          btn.className = 'mesa-reserva-btn-whats';
          if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
        }
      });
  }

  function iniciarPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(function () {
      atualizarDisponibilidadeAgora();
      atualizarResumo();
    }, POLL_MS);
  }

  function bindMascara(id, fn, onAfter) {
    var el = $(id);
    if (!el) return;
    el.addEventListener('input', function () {
      el.value = fn(el.value);
      if (onAfter) onAfter();
      atualizarResumo();
    });
    el.addEventListener('change', function () {
      if (onAfter) onAfter();
      atualizarResumo();
    });
  }

  function init() {
    popularSelectHorarios(null);
    atualizarDisponibilidadeAgora();
    iniciarPolling();

    bindMascara('mesa-data', mascaraData, onDataChange);
    bindMascara('mesa-pessoas', mascaraPessoas, function () {
      popularSelectHorarios(horariosDispCache);
    });

    var horSel = $('mesa-horario');
    if (horSel) {
      horSel.addEventListener('change', function () {
        atualizarDisponibilidadeAgora();
        atualizarResumo();
      });
    }

    var tel = $('mesa-telefone');
    if (tel) {
      tel.addEventListener('input', function () {
        tel.value = mascaraTelefone(tel.value);
      });
    }

    var nome = $('mesa-nome');
    if (nome) nome.addEventListener('input', atualizarResumo);

    var btn = $('mesa-btn-reservar');
    if (btn) btn.addEventListener('click', enviarReserva);

    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
