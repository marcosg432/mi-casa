(function initTransferVan() {
  var root = document.querySelector('[data-transfer-van]');
  if (!root) return;

  var swiperEl = root.querySelector('.transfer-swiper');
  var paginationEl = root.querySelector('.transfer-swiper-pagination');
  if (!swiperEl || typeof Swiper === 'undefined') return;

  var prefersReduced =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var swiper = new Swiper(swiperEl, {
    effect: 'fade',
    fadeEffect: { crossFade: true },
    speed: prefersReduced ? 0 : 1400,
    loop: true,
    allowTouchMove: true,
    pagination: paginationEl
      ? {
          el: paginationEl,
          clickable: true,
          bulletClass: 'swiper-pagination-bullet',
          bulletActiveClass: 'swiper-pagination-bullet-active'
        }
      : undefined,
    autoplay: prefersReduced
      ? false
      : {
          delay: 20000,
          disableOnInteraction: false,
          pauseOnMouseEnter: true
        }
  });

  var gate = root.closest('.revelar-quando-visivel');

  function iniciarAutoplay() {
    if (prefersReduced || !swiper.autoplay) return;
    swiper.autoplay.start();
  }

  function pausarAutoplay() {
    if (!swiper.autoplay) return;
    swiper.autoplay.stop();
  }

  function secaoVisivel() {
    return !gate || gate.classList.contains('esta-revelada');
  }

  if (gate && !gate.classList.contains('esta-revelada')) {
    gate.addEventListener(
      'secao-revelada',
      function onRev() {
        gate.removeEventListener('secao-revelada', onRev);
        iniciarAutoplay();
      },
      { once: true }
    );
    pausarAutoplay();
  } else {
    iniciarAutoplay();
  }

  document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
      pausarAutoplay();
    } else if (secaoVisivel()) {
      iniciarAutoplay();
    }
  });
})();
