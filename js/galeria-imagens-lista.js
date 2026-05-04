/**
 * Mesma lista que galeria.html (pasta imagem/). Usada no painel para escolher fotos já no site.
 */
(function (global) {
  var N = [
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
    [23, 'jpg'],
    [24, 'webp'],
    [25, 'webp'],
    [26, 'webp'],
    [27, 'webp'],
    [28, 'webp'],
    [29, 'jpg'],
    [30, 'webp'],
    [31, 'jpg'],
    [32, 'webp'],
    [33, 'jpg'],
    [34, 'webp'],
    [35, 'jpeg'],
    [36, 'webp'],
    [37, 'webp']
  ];
  global.GALERIA_IMAGENS_URLS = N.map(function (x) {
    return { url: 'imagem/' + x[0] + '.' + x[1], num: x[0] };
  });
})(window);
