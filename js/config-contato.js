(function (global) {
  var WHATSAPP_NUMERO = '559180781514';

  function buildWhatsAppUrl(texto) {
    return 'https://wa.me/' + WHATSAPP_NUMERO + '?text=' + encodeURIComponent(texto);
  }

  global.MiCasaContato = {
    WHATSAPP_NUMERO: WHATSAPP_NUMERO,
    buildWhatsAppUrl: buildWhatsAppUrl
  };
})(typeof window !== 'undefined' ? window : globalThis);
