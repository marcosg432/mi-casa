(function () {
  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }
  try {
    sessionStorage.removeItem('galeriaScrollPos');
  } catch (e) {}

  function irTopo() {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }

  irTopo();
  window.addEventListener('pageshow', function (e) {
    if (!e.persisted) irTopo();
  });
  window.addEventListener('load', function () {
    requestAnimationFrame(irTopo);
  });
})();
