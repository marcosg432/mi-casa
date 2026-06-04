(function initEventosCarrossel() {
  if (typeof Swiper === 'undefined') return;

  var prefersReduced =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var imagensGlobais = [];
  var swipers = [];

  function secaoAtiva(section) {
    return section && window.getComputedStyle(section).display !== 'none';
  }

  function galeriasVisiveis() {
    return Array.prototype.filter.call(document.querySelectorAll('[data-eventos-galeria]'), function (root) {
      return secaoAtiva(root.closest('section'));
    });
  }

  function aplicarBg(el) {
    if (!el || el.style.backgroundImage) return;
    var bg = el.getAttribute('data-bg');
    if (bg) el.style.backgroundImage = "url('" + bg + "')";
  }

  function coletarImagens(slideEls) {
    return Array.prototype.map.call(slideEls, function (el, index) {
      return {
        src: el.getAttribute('data-bg'),
        alt: el.getAttribute('aria-label') || 'Foto do espaço para eventos ' + (index + 1)
      };
    });
  }

  function carregarFotos(slideEls, incluirTodas) {
    if (!slideEls.length) return;
    aplicarBg(slideEls[0]);
    if (incluirTodas) {
      for (var i = 1; i < slideEls.length; i++) aplicarBg(slideEls[i]);
      return;
    }
    window.setTimeout(function () {
      for (var j = 1; j < slideEls.length; j++) aplicarBg(slideEls[j]);
    }, 2000);
  }

  function initGaleria(root) {
    if (root.dataset.eventosGaleriaInit === '1') return;

    var swiperEl = root.querySelector('.eventos-galeria-swiper');
    var paginationEl = root.querySelector('.eventos-galeria-pagination');
    if (!swiperEl) return;

    var slideEls = root.querySelectorAll('.eventos-galeria-slide[data-bg]');
    var imagens = coletarImagens(slideEls);
    if (!imagensGlobais.length && imagens.length) imagensGlobais = imagens;

    root.dataset.eventosGaleriaInit = '1';

    var swiper = new Swiper(swiperEl, {
      effect: 'fade',
      fadeEffect: { crossFade: true },
      speed: prefersReduced ? 0 : 1200,
      loop: imagens.length > 1,
      allowTouchMove: true,
      resistanceRatio: 0,
      observer: true,
      observeParents: true,
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

    swiper.on('slideChange', function () {
      var idx = swiper.realIndex;
      if (slideEls[idx]) aplicarBg(slideEls[idx]);
    });

    var gate = root.closest('.revelar-quando-visivel');

    function iniciarAutoplay() {
      if (prefersReduced || !swiper.autoplay) return;
      if (!gate || gate.classList.contains('esta-revelada')) swiper.autoplay.start();
    }

    function pausarAutoplay() {
      if (!swiper.autoplay) return;
      swiper.autoplay.stop();
    }

    function bootGaleria() {
      carregarFotos(slideEls, false);
      swiper.update();
      iniciarAutoplay();
    }

    if (gate && !gate.classList.contains('esta-revelada')) {
      gate.addEventListener(
        'secao-revelada',
        function onRev() {
          gate.removeEventListener('secao-revelada', onRev);
          bootGaleria();
        },
        { once: true }
      );
      pausarAutoplay();
    } else {
      bootGaleria();
    }

    swipers.push({ swiper: swiper, gate: gate, pausar: pausarAutoplay, iniciar: iniciarAutoplay });

    slideEls.forEach(function (slide) {
      var slideIndex = parseInt(slide.getAttribute('data-index'), 10);
      if (Number.isNaN(slideIndex)) return;

      function abrir(ev) {
        if (ev) {
          ev.preventDefault();
          ev.stopPropagation();
        }
        if (window.EventosGaleriaLightbox) window.EventosGaleriaLightbox.open(slideIndex);
      }

      slide.addEventListener('click', abrir);
      slide.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') abrir(ev);
      });
    });
  }

  function bootCarrosseis() {
    galeriasVisiveis().forEach(initGaleria);
  }

  bootCarrosseis();

  window.addEventListener('resize', function () {
    bootCarrosseis();
    swipers.forEach(function (item) {
      if (item.swiper && typeof item.swiper.update === 'function') item.swiper.update();
    });
  });

  document.addEventListener('visibilitychange', function () {
    swipers.forEach(function (item) {
      if (document.hidden) {
        item.pausar();
      } else if (!item.gate || item.gate.classList.contains('esta-revelada')) {
        item.iniciar();
      }
    });
  });

  (function lightboxEventos() {
    var lightbox = document.getElementById('lightbox-eventos');
    var imgEl = document.getElementById('lightbox-eventos-img');
    var backdrop = document.getElementById('lightbox-eventos-backdrop');
    var prevBtn = document.getElementById('lightbox-eventos-prev');
    var nextBtn = document.getElementById('lightbox-eventos-next');
    if (!lightbox || !imgEl) return;

    var indexAtual = 0;

    function getImagens() {
      if (imagensGlobais.length) return imagensGlobais;
      var root = galeriasVisiveis()[0];
      if (!root) return [];
      return coletarImagens(root.querySelectorAll('.eventos-galeria-slide[data-bg]'));
    }

    function pausarTodos() {
      swipers.forEach(function (item) { item.pausar(); });
    }

    function retomarVisiveis() {
      swipers.forEach(function (item) {
        if (!item.gate || item.gate.classList.contains('esta-revelada')) item.iniciar();
      });
    }

    function goTo(i) {
      var imagens = getImagens();
      if (!imagens.length) return;
      indexAtual = (i % imagens.length + imagens.length) % imagens.length;
      var item = imagens[indexAtual];
      if (!item) return;
      imgEl.src = item.src;
      imgEl.alt = item.alt;
    }

    function openLightbox(clickIndex) {
      indexAtual = clickIndex;
      goTo(indexAtual);
      lightbox.classList.add('open');
      lightbox.setAttribute('aria-hidden', 'false');
      document.body.classList.add('lightbox-aberto');
      pausarTodos();
    }

    function closeLightbox() {
      lightbox.classList.remove('open');
      lightbox.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('lightbox-aberto');
      retomarVisiveis();
    }

    window.EventosGaleriaLightbox = { open: openLightbox, close: closeLightbox };

    if (backdrop) backdrop.addEventListener('click', closeLightbox);
    if (prevBtn) prevBtn.addEventListener('click', function () { goTo(indexAtual - 1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { goTo(indexAtual + 1); });

    document.addEventListener('keydown', function (ev) {
      if (!lightbox.classList.contains('open')) return;
      if (ev.key === 'Escape') closeLightbox();
      if (ev.key === 'ArrowLeft') { goTo(indexAtual - 1); ev.preventDefault(); }
      if (ev.key === 'ArrowRight') { goTo(indexAtual + 1); ev.preventDefault(); }
    });
  })();
})();
