(function () {
  function ativarIntro(intro) {
    if (!intro || intro.classList.contains('active')) return;
    intro.classList.add('active');
    try {
      sessionStorage.setItem('introPlayed', 'true');
    } catch (e) {}
  }

  function initIntro() {
    var intro = document.getElementById('intro');
    if (!intro) return;

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

    if (alreadyVisited) {
      ativarIntro(intro);
      return;
    }

    var logo = intro.querySelector('.logo');
    if (logo) {
      logo.style.cursor = 'pointer';
      logo.setAttribute('role', 'button');
      logo.setAttribute('tabindex', '0');
      logo.setAttribute('aria-label', 'Entrar no site');
      function entrar() {
        ativarIntro(intro);
      }
      logo.addEventListener('click', entrar);
      logo.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          entrar();
        }
      });
    }

    setTimeout(function () {
      ativarIntro(intro);
    }, 2000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initIntro);
  } else {
    initIntro();
  }
})();
