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

  var MAX_NOITES_ORCAMENTO = 5;
  var MSG_ORCAMENTO =
    'Estadias de 5 noites ou mais: entre em contato para solicitar um orçamento personalizado.';

  function tarifaPorPessoa(noites) {
    return noites === 1 ? 150 : 130;
  }

  function getCapacidade(quartoId) {
    return CAPACIDADE[String(quartoId || '').toLowerCase()] || 4;
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
        pagantes: totalPessoas,
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
        pagantes: totalPessoas,
        mensagemOrcamento: MSG_ORCAMENTO,
        erro: null
      };
    }

    var tarifa = tarifaPorPessoa(noites);
    var valorTotal = totalPessoas * tarifa * noites;

    return {
      noites: noites,
      valorDiaria: tarifa,
      valorAdicional: 0,
      valorTotal: valorTotal,
      requerOrcamento: false,
      pagantes: totalPessoas,
      mensagemOrcamento: null,
      erro: null
    };
  }

  function descricaoTarifaReserva(noites) {
    var n = Math.floor(Number(noites) || 0);
    if (n <= 0) {
      return 'Escolha as datas para ver o valor por pessoa.';
    }
    if (n >= MAX_NOITES_ORCAMENTO) {
      return (
        'Estadias de ' +
        MAX_NOITES_ORCAMENTO +
        ' dias ou mais precisam de orçamento personalizado.'
      );
    }
    if (n === 1) {
      return '1 diária: R$ 150 por pessoa. Com 2 ou mais diárias, R$ 130 por pessoa/diária.';
    }
    return (
      n +
      ' diárias: R$ 130 por pessoa/diária (tarifa reduzida em relação à diária avulsa de R$ 150).'
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
    tarifaPorPessoa: tarifaPorPessoa,
    getCapacidade: getCapacidade,
    calcular: calcular,
    formatarValorTotal: formatarValorTotal,
    descricaoTarifaReserva: descricaoTarifaReserva
  };
})(window);
