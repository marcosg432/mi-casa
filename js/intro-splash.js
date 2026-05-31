(function () {
  function liberarScrollPagina() {
    document.body.classList.remove('intro-menu-aberto-no-body');
    document.body.style.removeProperty('overflow');
    document.documentElement.style.removeProperty('overflow');
  }

  function ativarIntro(intro) {
    if (!intro || intro.classList.contains('active')) return;
    intro.classList.add('active');
    liberarScrollPagina();
    try {
      sessionStorage.setItem('introPlayed', 'true');
    } catch (e) {}
  }

  function registrarEntradaPorGestos(intro, entrar) {
    var feito = false;
    var touchStartY = 0;

    function cleanup() {
      document.removeEventListener('touchstart', onTouchStart, opts);
      document.removeEventListener('touchmove', onTouchMove, opts);
      window.removeEventListener('wheel', entrar, opts);
      window.removeEventListener('scroll', entrar, opts);
    }

    function done() {
      if (feito) return;
      feito = true;
      entrar();
      cleanup();
    }

    var opts = { passive: true, capture: true };

    function onTouchStart(e) {
      if (e.touches && e.touches[0]) {
        touchStartY = e.touches[0].clientY;
      }
    }

    function onTouchMove(e) {
      if (!e.touches || !e.touches[0]) return;
      if (Math.abs(e.touches[0].clientY - touchStartY) > 6) {
        done();
      }
    }

    document.addEventListener('touchstart', onTouchStart, opts);
    document.addEventListener('touchmove', onTouchMove, opts);
    window.addEventListener('wheel', done, opts);
    window.addEventListener('scroll', done, opts);
  }

  function initIntro() {
    var intro = document.getElementById('intro');
    if (!intro) return;

    if (intro.classList.contains('active')) {
      liberarScrollPagina();
      return;
    }

    var navEntries =
      typeof performance !== 'undefined' && performance.getEntriesByType
        ? performance.getEntriesByType('navigation')
        : [];
    if (navEntries.length > 0 && navEntries[0].type === 'reload') {
      try {
        sessionStorage.removeItem('introPlayed');
      } catch (e) {}
    }

    var alreadyVisited = null;
    try {
      alreadyVisited = sessionStorage.getItem('introPlayed');
    } catch (e) {}

    function entrar() {
      ativarIntro(intro);
    }

    if (alreadyVisited) {
      entrar();
      return;
    }

    var logo = intro.querySelector('.logo');
    if (logo) {
      logo.style.cursor = 'pointer';
      logo.setAttribute('role', 'button');
      logo.setAttribute('tabindex', '0');
      logo.setAttribute('aria-label', 'Entrar no site');
      logo.addEventListener('click', entrar);
      logo.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          entrar();
        }
      });
    }

    registrarEntradaPorGestos(intro, entrar);

    setTimeout(entrar, 2000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initIntro);
  } else {
    initIntro();
  }
})();
