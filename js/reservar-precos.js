/**
 * Regras de preço e mensagem WhatsApp — reservas Mi Casa, Su Casa.
 */
(function (global) {
  var CAPACIDADES = {
    'tem-tem': 4,
    sabia: 4,
    soco: 4,
    ararajuba: 3
  };

  var MAX_NOITES_AUTO = 5;
  var WHATSAPP_PROPRIETARIO = '559180781514';
  var MSG_ORCAMENTO =
    'A partir de 5 noites, o valor exibido é uma média de referência. Entre em contato para confirmar o orçamento final.';

  function capacidadeQuarto(quartoId) {
    var id = String(quartoId || '').toLowerCase();
    return CAPACIDADES[id] != null ? CAPACIDADES[id] : 4;
  }

  function formatMoney(v) {
    return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function formatDataBr(iso) {
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || '—';
    var p = iso.split('-');
    return p[2] + '/' + p[1] + '/' + p[0];
  }

  /**
   * Faixa de referência para orçamento (5+ noites): diária R$ 130–150 e extras R$ 70–100.
   */
  function calcFaixaOrcamento(opts) {
    var quartoId = String(opts.quartoId || '').toLowerCase();
    var noites = Math.max(0, Math.floor(Number(opts.noites) || 0));
    var adultos = Math.max(1, Math.floor(Number(opts.adultos) || 1));
    var cap = capacidadeQuarto(quartoId);
    var extrasAlém = Math.max(0, Math.floor(Number(opts.pessoasAlémCap) || 0));
    var criancas = Math.max(0, Math.floor(Number(opts.criancas) || 0));
    var totalPessoas = extrasAlém > 0 ? cap + extrasAlém : adultos + criancas;
    var pessoasAlémCap = Math.max(0, totalPessoas - cap);

    if (noites <= 0) {
      return { valorMin: 0, valorMax: 0, valorMedio: 0 };
    }

    var diariaMin = 130;
    var diariaMax = 150;
    var extraMin = 70;
    var extraMax = 100;
    var baseMin;
    var baseMax;

    if (quartoId === 'tem-tem') {
      baseMin = adultos * diariaMin * noites;
      baseMax = adultos * diariaMax * noites;
    } else {
      baseMin = diariaMin * noites;
      baseMax = diariaMax * noites;
    }

    var adMin = pessoasAlémCap > 0 ? pessoasAlémCap * extraMin * noites : 0;
    var adMax = pessoasAlémCap > 0 ? pessoasAlémCap * extraMax * noites : 0;
    var valorMin = baseMin + adMin;
    var valorMax = baseMax + adMax;

    return {
      valorMin: valorMin,
      valorMax: valorMax,
      valorMedio: Math.round((valorMin + valorMax) / 2)
    };
  }

  function formatFaixaOrcamentoTexto(faixa) {
    if (!faixa || faixa.valorMin <= 0 || faixa.valorMax <= 0) return MSG_ORCAMENTO;
    if (faixa.valorMin === faixa.valorMax) {
      return 'média de valor: ' + formatMoney(faixa.valorMin);
    }
    return 'média de valor entre ' + formatMoney(faixa.valorMin) + ' e ' + formatMoney(faixa.valorMax);
  }

  function faixaOrcamentoReserva(reserva) {
    if (!reserva) return { valorMin: 0, valorMax: 0, valorMedio: 0 };
    var cap = capacidadeQuarto(reserva.quartoId);
    var adultos = Math.max(1, Math.floor(Number(reserva.adultos) || 1));
    var criancas = Math.max(0, Math.floor(Number(reserva.criancas) || 0));
    var pessoasAlémCap = reserva.pessoasAlémCap;
    if (pessoasAlémCap == null) {
      var total = Math.max(0, Math.floor(Number(reserva.pessoas) || adultos + criancas));
      pessoasAlémCap = Math.max(0, total - cap);
    }
    return calcFaixaOrcamento({
      quartoId: reserva.quartoId,
      noites: reserva.noites,
      adultos: adultos,
      criancas: criancas,
      pessoasAlémCap: pessoasAlémCap
    });
  }

  function calcReserva(opts) {
    var quartoId = String(opts.quartoId || '').toLowerCase();
    var noites = Math.max(0, Math.floor(Number(opts.noites) || 0));
    var adultos = Math.max(1, Math.floor(Number(opts.adultos) || 1));
    var criancas = Math.max(0, Math.floor(Number(opts.criancas) || 0));
    var cap = capacidadeQuarto(quartoId);
    var extrasAlém = Math.max(0, Math.floor(Number(opts.pessoasAlémCap) || 0));
    var totalPessoas = extrasAlém > 0 ? cap + extrasAlém : adultos + criancas;
    var pessoasAlémCap = Math.max(0, totalPessoas - cap);

    var base = {
      quartoId: quartoId,
      noites: noites,
      adultos: adultos,
      criancas: criancas,
      totalPessoas: totalPessoas,
      pessoasAlémCap: pessoasAlémCap,
      capacidade: cap,
      requerOrcamento: false,
      mensagem: '',
      valorBase: 0,
      valorAdicional: 0,
      valorTotal: 0,
      valorDiaria: 0
    };

    if (noites <= 0) {
      return Object.assign(base, { valorTotal: 0 });
    }

    var valorBase = 0;
    var valorDiaria = 0;

    if (quartoId === 'tem-tem') {
      /* TEM-TEM: R$ 150 por adulto por noite (crianças até 3 anos não entram em adultos). */
      valorDiaria = 150;
      valorBase = adultos * valorDiaria * noites;
    } else {
      valorDiaria = noites === 1 ? 150 : 130;
      valorBase = valorDiaria * noites;
    }

    var valorAdicional = 0;
    if (pessoasAlémCap > 0) {
      var tarifaExtra = noites === 1 ? 100 : noites === 2 ? 80 : 70;
      valorAdicional = pessoasAlémCap * tarifaExtra * noites;
    }

    var valorTotal = valorBase + valorAdicional;
    var resultado = Object.assign(base, {
      valorDiaria: valorDiaria,
      valorBase: valorBase,
      valorAdicional: valorAdicional,
      valorTotal: valorTotal
    });

    if (noites >= MAX_NOITES_AUTO) {
      var faixa = calcFaixaOrcamento(opts);
      return Object.assign(resultado, {
        requerOrcamento: true,
        mensagem: MSG_ORCAMENTO,
        valorMin: faixa.valorMin,
        valorMax: faixa.valorMax,
        valorMedio: faixa.valorMedio
      });
    }

    return resultado;
  }

  function quartoTitulo(quartoId, tituloOverride) {
    if (tituloOverride) return String(tituloOverride).trim().toLocaleUpperCase('pt-BR');
    var id = String(quartoId || '');
    var map = {
      'tem-tem': 'TEM-TEM',
      sabia: 'SABIÁ',
      soco: 'SOCÓ',
      ararajuba: 'ARARAJUBA'
    };
    return map[id] || String(id || '').toLocaleUpperCase('pt-BR') || '—';
  }

  function buildWhatsAppUrl(reserva) {
    var valorLinha;
    if (reserva.requerOrcamento) {
      var faixa =
        reserva.valorMin != null && reserva.valorMax != null
          ? { valorMin: reserva.valorMin, valorMax: reserva.valorMax }
          : faixaOrcamentoReserva(reserva);
      valorLinha =
        faixa.valorMin > 0 && faixa.valorMax > 0
          ? 'Orçamento (de 5 noites ou mais): ' + formatFaixaOrcamentoTexto(faixa)
          : 'Orçamento personalizado (de 5 noites ou mais)';
    } else if (reserva.valorTotal == null) {
      valorLinha = 'Orçamento personalizado';
    } else {
      valorLinha = 'Valor Total: ' + formatMoney(reserva.valorTotal);
    }
    var codigo = reserva.codigo || reserva.id || '—';
    var msg =
      'Olá! Gostaria de confirmar minha reserva na Mi Casa, Su Casa.\n\n' +
      'Código da reserva: #' + codigo + '\n\n' +
      'Nome: ' + (reserva.nome || '—') + '\n' +
      'E-mail: ' + (reserva.email || '—') + '\n' +
      'Telefone: ' + (reserva.telefone || '—') + '\n' +
      'Quarto: ' + quartoTitulo(reserva.quartoId, reserva.quartoTitulo) + '\n' +
      'Entrada: ' + formatDataBr(reserva.dataEntrada) + '\n' +
      'Saída: ' + formatDataBr(reserva.dataSaida) + '\n' +
      'Noites: ' + (reserva.noites != null ? reserva.noites : '—') + '\n' +
      'Adultos: ' + (reserva.adultos != null ? reserva.adultos : '—') + '\n' +
      'Crianças: ' + (reserva.criancas != null ? reserva.criancas : '0') + '\n' +
      valorLinha;

    return 'https://wa.me/' + WHATSAPP_PROPRIETARIO + '?text=' + encodeURIComponent(msg);
  }

  global.ReservaPrecos = {
    CAPACIDADES: CAPACIDADES,
    MAX_NOITES_AUTO: MAX_NOITES_AUTO,
    MSG_ORCAMENTO: MSG_ORCAMENTO,
    WHATSAPP_PROPRIETARIO: WHATSAPP_PROPRIETARIO,
    capacidadeQuarto: capacidadeQuarto,
    calcReserva: calcReserva,
    calcFaixaOrcamento: calcFaixaOrcamento,
    faixaOrcamentoReserva: faixaOrcamentoReserva,
    formatFaixaOrcamentoTexto: formatFaixaOrcamentoTexto,
    buildWhatsAppUrl: buildWhatsAppUrl,
    formatMoney: formatMoney,
    formatDataBr: formatDataBr,
    quartoTitulo: quartoTitulo
  };
})(window);
