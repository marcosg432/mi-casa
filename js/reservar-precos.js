/**
 * Regras de preço e mensagem WhatsApp — reservas Mi Casa, Su Casa.
 * Cobrança por pessoa; o quarto inteiro fica indisponível no período.
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

  function tarifaPorPessoa(noites) {
    return noites === 1 ? 150 : 130;
  }

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

  function calcFaixaOrcamento(opts) {
    var noites = Math.max(0, Math.floor(Number(opts.noites) || 0));
    var adultos = Math.max(1, Math.floor(Number(opts.adultos) || 1));
    var criancas = Math.max(0, Math.floor(Number(opts.criancas) || 0));
    var totalPessoas = adultos + criancas;

    if (noites <= 0 || totalPessoas <= 0) {
      return { valorMin: 0, valorMax: 0, valorMedio: 0 };
    }

    var valorMin = totalPessoas * 130 * noites;
    var valorMax = totalPessoas * 150 * noites;

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
    var adultos = Math.max(1, Math.floor(Number(reserva.adultos) || 1));
    var criancas = Math.max(0, Math.floor(Number(reserva.criancas) || 0));
    return calcFaixaOrcamento({
      noites: reserva.noites,
      adultos: adultos,
      criancas: criancas
    });
  }

  function calcReserva(opts) {
    var quartoId = String(opts.quartoId || '').toLowerCase();
    var noites = Math.max(0, Math.floor(Number(opts.noites) || 0));
    var adultos = Math.max(1, Math.floor(Number(opts.adultos) || 1));
    var criancas = Math.max(0, Math.floor(Number(opts.criancas) || 0));
    var cap = capacidadeQuarto(quartoId);
    var totalPessoas = adultos + criancas;

    var base = {
      quartoId: quartoId,
      noites: noites,
      adultos: adultos,
      criancas: criancas,
      totalPessoas: totalPessoas,
      pessoasAlémCap: 0,
      capacidade: cap,
      tarifaPorPessoa: 0,
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

    var tarifa = tarifaPorPessoa(noites);
    var valorTotal = totalPessoas * tarifa * noites;

    var resultado = Object.assign(base, {
      tarifaPorPessoa: tarifa,
      valorDiaria: tarifa,
      valorBase: valorTotal,
      valorAdicional: 0,
      valorTotal: valorTotal
    });

    if (noites >= MAX_NOITES_AUTO) {
      var faixa = calcFaixaOrcamento({ noites: noites, adultos: adultos, criancas: criancas });
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
    var totalPessoas =
      reserva.totalPessoas != null
        ? reserva.totalPessoas
        : Math.max(0, Number(reserva.adultos || 0) + Number(reserva.criancas || 0));
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
      'Pessoas: ' + totalPessoas + ' (adultos: ' + (reserva.adultos != null ? reserva.adultos : '—') +
      ', crianças: ' + (reserva.criancas != null ? reserva.criancas : '0') + ')\n' +
      valorLinha;

    return 'https://wa.me/' + WHATSAPP_PROPRIETARIO + '?text=' + encodeURIComponent(msg);
  }

  global.ReservaPrecos = {
    CAPACIDADES: CAPACIDADES,
    MAX_NOITES_AUTO: MAX_NOITES_AUTO,
    MSG_ORCAMENTO: MSG_ORCAMENTO,
    WHATSAPP_PROPRIETARIO: WHATSAPP_PROPRIETARIO,
    tarifaPorPessoa: tarifaPorPessoa,
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
