/* Compatibilidade: HTML antigo em cache apontava para reservar.js — carrega o fluxo novo. */
(function () {
  if (window.__MCSC_RESERVAR_INIT || document.querySelector('script[data-reservar-flow="1"]')) {
    return;
  }
  var s = document.createElement('script');
  s.src = 'js/reservar-flow.js?v=20260601d';
  s.defer = true;
  s.setAttribute('data-reservar-flow', '1');
  document.head.appendChild(s);
})();
