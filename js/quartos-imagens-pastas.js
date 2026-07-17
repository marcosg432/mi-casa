/**
 * Imagens dos quartos por pasta: imagem/imagem quartos/{id-do-quarto}/
 * O id do quarto no site (tem-tem, soco, sabia, ararajuba) = nome da subpasta.
 */
(function (global) {
  var BASE = 'imagem/imagem quartos';

  /** Fallback estático — usado se a API não estiver disponível. */
  global.QUARTOS_IMAGENS_PASTAS = {
    'tem-tem': [
      BASE + '/tem-tem/quarto_01_web.webp',
      BASE + '/tem-tem/quarto_detalhe_web.webp',
      BASE + '/tem-tem/quarto_suite_web.webp',
      BASE + '/tem-tem/quarto_cortina_web.webp',
      BASE + '/tem-tem/imagem_convertida.webp'
    ],
    soco: [
      BASE + '/soco/10933a8a-60dd-4808-b943-0b3ab0c21c42.webp',
      BASE + '/soco/3485eeb9-01d6-4f14-974e-8960813932b4.webp',
      BASE + '/soco/8d5064e4-b315-4e59-a257-3afb2bd136f7.webp'
    ],
    sabia: [
      BASE + '/sabia/quarto2_convertido.webp',
      BASE + '/sabia/6f2c953a-7abd-4e08-997b-5335141a2ad6.webp',
      BASE + '/sabia/bdabf970-ef05-4773-9aef-a36dc26d31d2.webp',
      BASE + '/sabia/imagem_convertida_2.webp'
    ],
    ararajuba: [
      BASE + '/ararajuba/6949931c-86c1-4f37-8df9-b26a34f19aa5.webp',
      BASE + '/ararajuba/98cad899-a9b2-4611-be21-c3c56fef6c2c.webp',
      BASE + '/ararajuba/cacd8ad0-6493-4b26-95b8-1a8eebd1f796.webp',
      BASE + '/ararajuba/e7bf59b2-06d8-4b13-bb99-54a9d09426d7.webp'
    ]
  };

  global.quartoUrlImagem = function quartoUrlImagem(src) {
    var s = String(src || '').trim();
    if (!s || /^data:/i.test(s) || /^https?:\/\//i.test(s)) return s;
    try {
      s = decodeURI(s);
    } catch (eDec) {}
    return s;
  };

  global.quartoImagensDaPasta = function (quartoId) {
    var id = String(quartoId || '').trim();
    if (!id) return [];
    var map = global.QUARTOS_IMAGENS_PASTAS;
    if (!map || !Array.isArray(map[id])) return [];
    return map[id]
      .filter(function (src) {
        return String(src || '').trim() !== '';
      })
      .map(global.quartoUrlImagem);
  };

  /** Lista de URLs para carrossel (pasta do quarto ou imagem principal). */
  global.quartoImagensDoCatalogo = function (q) {
    if (!q) return [];
    var id = q.id != null ? String(q.id).trim() : '';
    if (id) {
      var daPasta = global.quartoImagensDaPasta(id);
      if (daPasta.length) return daPasta;
    }
    var principal = String(q.img || '').trim();
    return principal ? [global.quartoUrlImagem(principal)] : [];
  };

  function mesclarMapaImagens(apiMap) {
    var base = global.QUARTOS_IMAGENS_PASTAS || {};
    var merged = Object.assign({}, base);
    if (!apiMap || typeof apiMap !== 'object' || Array.isArray(apiMap)) return merged;
    Object.keys(apiMap).forEach(function (id) {
      if (Array.isArray(apiMap[id]) && apiMap[id].length) merged[id] = apiMap[id];
    });
    global.QUARTOS_IMAGENS_PASTAS = merged;
    return merged;
  }

  global.carregarImagensQuartosPastas = function () {
    var fallback = Object.assign({}, global.QUARTOS_IMAGENS_PASTAS || {});
    return fetch('/api/quartos-imagens')
      .then(function (r) {
        if (!r.ok) return fallback;
        return r.json();
      })
      .then(function (data) {
        return mesclarMapaImagens(data);
      })
      .catch(function () {
        global.QUARTOS_IMAGENS_PASTAS = fallback;
        return fallback;
      });
  };
})(window);
