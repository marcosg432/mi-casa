/**
 * Hero: carrega só a 1ª foto na entrada; demais slides e bloco mobile/desktop oculto ficam para depois.
 */
(function () {
  function isMobileViewport() {
    return window.matchMedia('(max-width: 768px)').matches;
  }

  function carouselVisivel(carousel) {
    var mobile = carousel.closest('.inicio-visivel-apenas-mobile');
    var desktop = carousel.closest('.inicio-visivel-apenas-desktop');
    if (mobile) return isMobileViewport();
    if (desktop) return !isMobileViewport();
    return true;
  }

  function aplicarBg(el) {
    if (!el || el.style.backgroundImage) return;
    var bg = el.getAttribute('data-bg');
    if (bg) el.style.backgroundImage = "url('" + bg + "')";
  }

  function initCarousel(carousel) {
    if (!carousel || carousel.dataset.heroLazyInit === '1') return;
    if (!carouselVisivel(carousel)) return;
    carousel.dataset.heroLazyInit = '1';

    var slides = carousel.querySelectorAll('.hero-slide[data-bg]');
    if (!slides.length) return;

    aplicarBg(slides[0]);

    window.setTimeout(function () {
      for (var i = 1; i < slides.length; i++) aplicarBg(slides[i]);
    }, 1500);
  }

  function init() {
    document.querySelectorAll('.hero-carousel').forEach(initCarousel);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  var resizeTimer;
  window.addEventListener(
    'resize',
    function () {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(init, 200);
    },
    { passive: true }
  );
})();
