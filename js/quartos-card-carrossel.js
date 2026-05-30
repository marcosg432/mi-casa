(function initQuartosCardCarrosseis() {
  var instances = new WeakMap();

  function destroyIn(root) {
    if (!root || !root.querySelectorAll) return;
    root.querySelectorAll('[data-quarto-carrossel]').forEach(function (wrap) {
      var sw = instances.get(wrap);
      if (sw && typeof sw.destroy === 'function') {
        sw.destroy(true, true);
        instances.delete(wrap);
      }
    });
  }

  window.initQuartosCardCarrosseis = function (root) {
    if (typeof Swiper === 'undefined') return;
    var scope = root && root.querySelectorAll ? root : document;
    destroyIn(scope);

    var prefersReduced =
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    scope.querySelectorAll('[data-quarto-carrossel]').forEach(function (wrap) {
      var swiperEl = wrap.querySelector('.quarto-swiper');
      var paginationEl = wrap.querySelector('.quarto-swiper-pagination');
      if (!swiperEl) return;

      var count = swiperEl.querySelectorAll('.swiper-slide').length;
      if (count < 2) return;

      var swiper = new Swiper(swiperEl, {
        effect: 'fade',
        fadeEffect: { crossFade: true },
        speed: prefersReduced ? 0 : 900,
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
              delay: 5000,
              disableOnInteraction: false,
              pauseOnMouseEnter: true
            }
      });

      instances.set(wrap, swiper);

      if (!prefersReduced && swiper.autoplay) {
        swiper.autoplay.start();
      }
    });
  };

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) return;
    document.querySelectorAll('[data-quarto-carrossel]').forEach(function (wrap) {
      var sw = instances.get(wrap);
      if (sw && sw.autoplay) sw.autoplay.start();
    });
  });
})();
