'use strict';

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
    return { noites: 0, valorDiaria: 0, valorAdicional: 0, valorTotal: 0, requerOrcamento: false, erro: 'Período inválido.' };
  }
  if (totalPessoas < 1) {
    return { erro: 'Informe pelo menos 1 hóspede.' };
  }
  if (totalPessoas > cap) {
    return { erro: 'Capacidade máxima do quarto: ' + cap + ' pessoas.' };
  }
  if (adultos < 1) {
    return { erro: 'Informe pelo menos 1 adulto.' };
  }
  if (noites >= MAX_NOITES_ORCAMENTO) {
    return {
      noites: noites,
      valorDiaria: 0,
      valorAdicional: 0,
      valorTotal: null,
      requerOrcamento: true,
      erro: null
    };
  }

  var pagantes = adultos;
  var tarifa = tarifaNoiteQuarto(noites);
  var valorDiaria = tarifa;
  var valorAdicional = 0;
  var valorTotal = 0;

  if (isQuartoPorPessoa(quartoId)) {
    valorTotal = pagantes * tarifa * noites;
  } else {
    var extras = Math.max(0, pagantes - PESSOAS_INCLUIDAS_QUARTO);
    valorAdicional = extras * tarifaPessoaAdicional(noites) * noites;
    valorTotal = tarifa * noites + valorAdicional;
  }

  return {
    noites: noites,
    valorDiaria: valorDiaria,
    valorAdicional: valorAdicional,
    valorTotal: valorTotal,
    requerOrcamento: false,
    erro: null
  };
}

module.exports = {
  CAPACIDADE: CAPACIDADE,
  MAX_NOITES_ORCAMENTO: MAX_NOITES_ORCAMENTO,
  MSG_ORCAMENTO: MSG_ORCAMENTO,
  getCapacidade: getCapacidade,
  calcular: calcular
};
