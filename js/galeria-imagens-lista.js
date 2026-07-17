/**
 * Fotos da pasta imagem/ — galeria, painel e animação 3D.
 * Números: 1–37 (só os que existem na pasta). Série ep.
 */
(function (global) {
  var NUMS = [
    [1, 'webp'],
    [2, 'webp'],
    [3, 'webp'],
    [5, 'webp'],
    [6, 'webp'],
    [7, 'webp'],
    [8, 'webp'],
    [9, 'webp'],
    [10, 'webp'],
    [11, 'webp'],
    [14, 'webp'],
    [15, 'webp'],
    [16, 'webp'],
    [17, 'webp'],
    [18, 'webp'],
    [19, 'webp'],
    [20, 'webp'],
    [21, 'webp'],
    [22, 'webp'],
    [23, 'webp'],
    [24, 'webp'],
    [25, 'webp'],
    [26, 'webp'],
    [27, 'webp'],
    [28, 'webp'],
    [29, 'webp'],
    [30, 'webp'],
    [31, 'webp'],
    [32, 'webp'],
    [33, 'webp'],
    [34, 'webp'],
    [35, 'webp'],
    [36, 'webp'],
    [37, 'webp']
  ];

  var EP = [
    [1, 'webp'],
    [2, 'webp'],
    [3, 'webp'],
    [4, 'webp'],
    [5, 'webp'],
    [6, 'webp'],
    [7, 'webp'],
    [8, 'webp'],
    [9, 'webp'],
    [10, 'webp'],
    [11, 'webp'],
    [12, 'webp'],
    [15, 'webp'],
    [16, 'webp'],
    [17, 'webp'],
    [18, 'webp'],
    [19, 'webp']
  ];

  var list = [];

  NUMS.forEach(function (x) {
    list.push({
      url: 'imagem/' + x[0] + '.' + x[1],
      num: x[0],
      label: String(x[0])
    });
  });

  EP.forEach(function (x) {
    var file = 'ep ' + x[0] + '.' + x[1];
    list.push({
      url: 'imagem/' + encodeURIComponent(file),
      num: null,
      label: 'ep ' + x[0]
    });
  });

  global.GALERIA_IMAGENS_URLS = list;
})(window);
