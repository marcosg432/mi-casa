/**
 * Regras de preço e capacidade — Mi Casa, Su Casa
 */
(function (global) {
  var CAPACIDADE = {
    'tem-tem': 4,
    sabia: 4,
    soco: 4,
    ararajuba: 3
  };

  var QUARTOS_POR_PESSOA = {
    'tem-tem': true
  };

  var PESSOAS_INCLUIDAS_QUARTO = 2;
  var MAX_NOITES_ORCAMENTO = 5;
  var MSG_ORCAMENTO =
    'Estadias de 5 noites ou mais: entre em contato para solicitar um orçamento personalizado.';

  function tarifaNoiteQuarto(noites) {
    return noites === 1 ? 150 : 130;
  }

  function tarifaPessoaAdicional(noites) {
    return noites === 1 ? 100 : 80;
  }

  function getCapacidade(quartoId) {
    return CAPACIDADE[String(quartoId || '').toLowerCase()] || 4;
  }

  function isQuartoPorPessoa(quartoId) {
    return !!QUARTOS_POR_PESSOA[String(quartoId || '').toLowerCase()];
  }

  function calcular(opts) {
    var quartoId = String(opts.quartoId || '').toLowerCase();
    var noites = Math.max(0, Math.floor(Number(opts.noites) || 0));
    var adultos = Math.max(0, Math.floor(Number(opts.adultos) || 0));
    var criancas = Math.max(0, Math.floor(Number(opts.criancas) || 0));
    var totalPessoas = adultos + criancas;
    var cap = getCapacidade(quartoId);

    if (noites <= 0) {
      return {
        noites: 0,
        valorDiaria: 0,
        valorAdicional: 0,
        valorTotal: 0,
        requerOrcamento: false,
        pagantes: 0,
        erro: null
      };
    }

    if (totalPessoas < 1) {
      return {
        noites: noites,
        valorDiaria: 0,
        valorAdicional: 0,
        valorTotal: 0,
        requerOrcamento: false,
        pagantes: 0,
        erro: 'Informe pelo menos 1 hóspede.'
      };
    }

    if (totalPessoas > cap) {
      return {
        noites: noites,
        valorDiaria: 0,
        valorAdicional: 0,
        valorTotal: 0,
        requerOrcamento: false,
        pagantes: adultos,
        erro: 'Capacidade máxima do quarto: ' + cap + ' pessoas.'
      };
    }

    if (adultos < 1) {
      return {
        noites: noites,
        valorDiaria: 0,
        valorAdicional: 0,
        valorTotal: 0,
        requerOrcamento: false,
        pagantes: 0,
        erro: 'Informe pelo menos 1 adulto.'
      };
    }

    if (noites >= MAX_NOITES_ORCAMENTO) {
      return {
        noites: noites,
        valorDiaria: 0,
        valorAdicional: 0,
        valorTotal: null,
        requerOrcamento: true,
        pagantes: adultos,
        mensagemOrcamento: MSG_ORCAMENTO,
        erro: null
      };
    }

    var pagantes = adultos;
    var tarifa = tarifaNoiteQuarto(noites);
    var valorDiaria = 0;
    var valorAdicional = 0;
    var valorTotal = 0;

    if (isQuartoPorPessoa(quartoId)) {
      valorDiaria = tarifa;
      valorTotal = pagantes * tarifa * noites;
    } else {
      valorDiaria = tarifa;
      var valorBase = tarifa * noites;
      var extras = Math.max(0, pagantes - PESSOAS_INCLUIDAS_QUARTO);
      var tarifaExtra = tarifaPessoaAdicional(noites);
      valorAdicional = extras * tarifaExtra * noites;
      valorTotal = valorBase + valorAdicional;
    }

    return {
      noites: noites,
      valorDiaria: valorDiaria,
      valorAdicional: valorAdicional,
      valorTotal: valorTotal,
      requerOrcamento: false,
      pagantes: pagantes,
      mensagemOrcamento: null,
      erro: null
    };
  }

  function descricaoTarifaReserva(noites, quartoId) {
    var n = Math.floor(Number(noites) || 0);
    if (n <= 0) {
      return 'Escolha as datas para ver o valor por noite.';
    }
    if (n >= MAX_NOITES_ORCAMENTO) {
      return (
        'Estadias de ' +
        MAX_NOITES_ORCAMENTO +
        ' dias ou mais precisam de orçamento personalizado.'
      );
    }
    if (n === 1) {
      if (isQuartoPorPessoa(quartoId)) {
        return '1 noite: R$ 150 por pessoa. Com 2 ou mais noites, o valor cai para R$ 130 por pessoa/noite.';
      }
      return '1 noite: R$ 150. A partir de 2 noites, o valor por noite cai para R$ 130.';
    }
    if (isQuartoPorPessoa(quartoId)) {
      return (
        n +
        ' noites com tarifa reduzida: R$ 130 por pessoa/noite (menor que R$ 150 da diária avulsa).'
      );
    }
    return (
      n +
      ' noites com tarifa reduzida: R$ 130/noite (menor que R$ 150 da diária avulsa).'
    );
  }

  function formatarValorTotal(resultado) {
    if (resultado.requerOrcamento) return MSG_ORCAMENTO;
    if (resultado.valorTotal == null) return '—';
    return resultado.valorTotal.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  }

  global.ReservaPrecos = {
    CAPACIDADE: CAPACIDADE,
    MSG_ORCAMENTO: MSG_ORCAMENTO,
    MAX_NOITES_ORCAMENTO: MAX_NOITES_ORCAMENTO,
    getCapacidade: getCapacidade,
    isQuartoPorPessoa: isQuartoPorPessoa,
    calcular: calcular,
    formatarValorTotal: formatarValorTotal,
    descricaoTarifaReserva: descricaoTarifaReserva
  };
})(window);
