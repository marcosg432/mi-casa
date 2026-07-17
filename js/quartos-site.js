/**
 * Catálogo base dos quartos (valores iniciais). O SystemStore pode sobrepor com dados
 * guardados no navegador (localStorage) ou, se existir SupabaseClient, com o servidor.
 *
 * Fotos do carrossel: pasta imagem/imagem quartos/{id}/ — ver js/quartos-imagens-pastas.js
 */
(function (global) {
  var FALLBACK = [
    {
      id: 'sabia',
      capacidade: 4,
      titulo: 'SABIÁ',
      tipo: 'Quarto Família com Suíte Privativa',
      desc:
        'Quarto família com suíte privativa exclusiva para os hóspedes deste quarto. Ambiente amplo, ar-condicionado, ventilador, cozinha compacta privativa e vista para o jardim. Até 4 pessoas · 40 m².',
      preco: 'R$ 150',
      precoLabel: 'diária por pessoa',
      img: 'imagem/imagem quartos/sabia/quarto2_convertido.webp',
      alt: 'Quarto SABIÁ — Mi Casa, Su Casa',
      verQuartoHref: 'quartos.html#quarto-sabia',
      ordem: 0,
      amenities: {
        arCondicionado: true,
        wifi: true,
        cozinhaCompacta: true,
        maquinaLavar: true,
        ventilador: true,
        banheiroPrivativo: true,
        camasCasal: 0,
        camasSolteiro: 2,
        metros2: 40
      }
    },
    {
      id: 'ararajuba',
      capacidade: 3,
      titulo: 'ARARAJUBA',
      tipo: 'Quarto Duplo com Banheiro Privativo',
      desc:
        'Quarto Duplo com Banheiro Privativo. Confortável para casais ou viajantes: cama de casal, uma cama de solteiro, ar-condicionado, ventilador, vista para o jardim e banheiro privativo com chuveiro. Até 3 pessoas · 20 m².',
      preco: 'R$ 150',
      precoLabel: 'diária por pessoa',
      img: 'imagem/imagem quartos/ararajuba/6949931c-86c1-4f37-8df9-b26a34f19aa5.webp',
      alt: 'Quarto ARARAJUBA — Mi Casa, Su Casa',
      verQuartoHref: 'quartos.html#quarto-ararajuba',
      ordem: 1,
      amenities: {
        arCondicionado: true,
        wifi: true,
        maquinaLavar: true,
        guardaRoupa: true,
        ventilador: true,
        banheiroPrivativo: true,
        camasCasal: 1,
        camasSolteiro: 1,
        metros2: 20
      }
    },
    {
      id: 'tem-tem',
      capacidade: 4,
      titulo: 'TEM-TEM',
      tipo: 'Quarto Duplo com Banheiro Compartilhado',
      desc:
        'Quarto Duplo com Banheiro Compartilhado. Quarto duplo aconchegante, ideal para casais: cama de casal, uma cama de solteiro, ar-condicionado, ventilador, vista para o jardim e banheiro compartilhado. Até 3 pessoas · 20 m².',
      preco: 'R$ 150',
      precoLabel: 'diária por pessoa',
      img: 'imagem/imagem quartos/tem-tem/quarto_01_web.webp',
      alt: 'Quarto TEM-TEM — Mi Casa, Su Casa',
      verQuartoHref: 'quartos.html#quarto-tem-tem',
      ordem: 2,
      amenities: {
        arCondicionado: true,
        wifi: true,
        maquinaLavar: true,
        guardaRoupa: true,
        ventilador: true,
        banheiroCompartilhado: true,
        camasCasal: 1,
        camasSolteiro: 1,
        metros2: 20
      }
    },
    {
      id: 'soco',
      capacidade: 4,
      titulo: 'SOCÓ',
      tipo: 'Quarto Família (4 Camas de Solteiro)',
      desc:
        'Quarto Família (4 Camas de Solteiro). Espaçoso, com quatro camas de solteiro, ventilador, cozinha compacta privativa, vista para o jardim e banheiro compartilhado. Até 4 pessoas · 40 m².',
      preco: 'R$ 150',
      precoLabel: 'diária por pessoa',
      img: 'imagem/imagem quartos/soco/10933a8a-60dd-4808-b943-0b3ab0c21c42.webp',
      alt: 'Quarto SOCÓ — Mi Casa, Su Casa',
      verQuartoHref: 'quartos.html#quarto-soco',
      ordem: 3,
      amenities: {
        wifi: true,
        cozinhaCompacta: true,
        maquinaLavar: true,
        ventilador: true,
        banheiroCompartilhado: true,
        camasSolteiro: 4,
        camasCasal: 0,
        metros2: 40
      }
    }
  ];

  var QUARTO_DESC_LIMITE = 300;
  global.QUARTOS_DESC_MAX = QUARTO_DESC_LIMITE;
  function tituloQuartoMaiusculo(s) {
    return String(s || '').trim().toLocaleUpperCase('pt-BR');
  }

  global.QUARTOS_SITE_FALLBACK = FALLBACK.map(function (q) {
    var o = Object.assign({}, q, { amenities: q.amenities || {} });
    var d = String(o.desc || '');
    if (d.length > QUARTO_DESC_LIMITE) o.desc = d.substring(0, QUARTO_DESC_LIMITE);
    o.titulo = tituloQuartoMaiusculo(o.titulo);
    return o;
  });
  global.QUARTOS_SITE = global.QUARTOS_SITE_FALLBACK.slice();
})(window);
