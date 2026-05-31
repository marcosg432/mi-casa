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
    resistanceRatio: 0,
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

  function aplicarTransferBg(el) {
    if (!el || el.style.backgroundImage) return;
    var bg = el.getAttribute('data-bg');
    if (bg) el.style.backgroundImage = "url('" + bg + "')";
  }

  function carregarFotosTransfer(incluirTodas) {
    var medias = root.querySelectorAll('.transfer-slide-media[data-bg]');
    if (!medias.length) return;
    aplicarTransferBg(medias[0]);
    if (incluirTodas) {
      for (var i = 1; i < medias.length; i++) aplicarTransferBg(medias[i]);
      return;
    }
    window.setTimeout(function () {
      for (var j = 1; j < medias.length; j++) aplicarTransferBg(medias[j]);
    }, 2500);
  }

  swiper.on('slideChange', function () {
    var medias = root.querySelectorAll('.transfer-slide-media[data-bg]');
    var idx = swiper.realIndex;
    if (medias[idx]) aplicarTransferBg(medias[idx]);
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
        carregarFotosTransfer(false);
        iniciarAutoplay();
      },
      { once: true }
    );
    pausarAutoplay();
  } else {
    carregarFotosTransfer(false);
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
