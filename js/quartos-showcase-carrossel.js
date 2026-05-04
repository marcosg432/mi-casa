/**
 * Carrossel 3D da secção Quartos (index e outras páginas com [data-quartos-showcase]).
 * Usa window.QUARTOS_SITE após SystemStore.hydrateQuartosSite().
 */
(function (global) {
  global.initQuartosShowcaseCarrossel = function initQuartosShowcaseCarrossel() {
    var src = global.QUARTOS_SITE || [];
    var QUARTOS = src.map(function (q) {
      return {
        titulo: q.titulo,
        desc: q.desc,
        preco: q.preco,
        precoLabel: q.precoLabel || 'Noite',
        img: q.img,
        alt: q.alt || q.titulo,
        href: 'reservar.html?quarto=' + encodeURIComponent(q.id)
      };
    });
    var N = QUARTOS.length;
    if (N < 1) return;

    var DUR_SLIDE_MS = 900;
    var richMotion = true;
    try {
      richMotion = !global.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e1) {}

    function aplicarSlides(slides, centerIdx) {
      for (var i = 0; i < slides.length; i++) {
        slides[i].classList.remove('pos-esquerda', 'pos-centro', 'pos-direita');
        if (i === centerIdx) slides[i].classList.add('pos-centro');
        else if (i === (centerIdx + 1) % 3) slides[i].classList.add('pos-direita');
        else slides[i].classList.add('pos-esquerda');
      }
    }

    function indiceQuartoNoSlide(centerIdx, slideIdx, roomIdx) {
      var off = (slideIdx - centerIdx + 3) % 3;
      return (roomIdx + off) % N;
    }

    var IMG_SIZES_HINT = '(max-width: 768px) 52vw, min(480px, 42vw)';

    /** Evita pedir as 3 fotos em resolução total ao mesmo tempo: centro primeiro, laterais com pequeno atraso. */
    function atualizarImagens(slides, centerIdx, roomIdx) {
      function assignSlide(i) {
        var qi = indiceQuartoNoSlide(centerIdx, i, roomIdx);
        var q = QUARTOS[qi];
        var img = slides[i].querySelector('img');
        if (!img || !q || !q.img) return;
        img.src = q.img;
        img.alt = q.alt || q.titulo || '';
        img.sizes = IMG_SIZES_HINT;
        img.decoding = 'async';
      }
      assignSlide(centerIdx);
      var delay = 90;
      for (var i = 0; i < slides.length; i++) {
        if (i === centerIdx) continue;
        (function (ii, ms) {
          window.setTimeout(function () {
            assignSlide(ii);
          }, ms);
        })(i, delay);
        delay += 110;
      }
    }

    function preencherCopy(copyInner, roomIdx) {
      var q = QUARTOS[roomIdx];
      if (!q) return;
      copyInner.querySelector('.quartos-showcase-titulo').textContent = q.titulo;
      copyInner.querySelector('.quartos-showcase-desc').textContent = q.desc;
      copyInner.querySelector('.quartos-showcase-preco-valor').textContent = q.preco;
      var lbl = copyInner.querySelector('.quartos-showcase-preco-label');
      if (lbl) lbl.textContent = q.precoLabel || 'Noite';
      var a = copyInner.querySelector('.quartos-showcase-btn');
      if (a) a.href = q.href;
    }

    function animarTexto(copyInner, novoRoomIdx) {
      if (!richMotion) {
        preencherCopy(copyInner, novoRoomIdx);
        return;
      }
      copyInner.classList.add('quartos-copy--saida');
      setTimeout(function () {
        preencherCopy(copyInner, novoRoomIdx);
        copyInner.classList.remove('quartos-copy--saida');
        copyInner.classList.add('quartos-copy--entrada-pre');
        void copyInner.offsetWidth;
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            copyInner.classList.remove('quartos-copy--entrada-pre');
            copyInner.classList.add('quartos-copy--entrada');
            setTimeout(function () {
              copyInner.classList.remove('quartos-copy--entrada');
            }, 580);
          });
        });
      }, 340);
    }

    function initRoot(root) {
      var slides = root.querySelectorAll('.quartos-3d-slide');
      if (slides.length !== 3) return;
      var copyInner = root.querySelector('.quartos-showcase-copy-inner');
      var prevBtn = root.querySelector('.quartos-showcase-nav--prev');
      var nextBtn = root.querySelector('.quartos-showcase-nav--next');
      if (!copyInner || !prevBtn || !nextBtn) return;

      var roomIdx = 0;
      var centerSlide = 0;
      var animando = false;

      function setBusy(b) {
        if (b) {
          root.setAttribute('aria-busy', 'true');
          prevBtn.disabled = true;
          nextBtn.disabled = true;
        } else {
          root.removeAttribute('aria-busy');
          prevBtn.disabled = false;
          nextBtn.disabled = false;
        }
      }

      function ir(dir) {
        if (animando || N < 2) return;
        animando = true;
        setBusy(true);

        var novoR = dir === 1 ? (roomIdx + 1) % N : (roomIdx + N - 1) % N;
        var novoC = dir === 1 ? (centerSlide + 1) % 3 : (centerSlide + 2) % 3;

        if (dir === 1) {
          var slidePatch = (centerSlide + 2) % 3;
          var qAlvo = QUARTOS[(roomIdx + 2) % N];
          var imgP = slides[slidePatch].querySelector('img');
          if (imgP && qAlvo) {
            imgP.src = qAlvo.img;
            imgP.alt = qAlvo.alt || qAlvo.titulo || '';
            imgP.sizes = IMG_SIZES_HINT;
            imgP.decoding = 'async';
          }
        }

        roomIdx = novoR;
        centerSlide = novoC;
        aplicarSlides(slides, centerSlide);
        animarTexto(copyInner, novoR);

        setTimeout(function () {
          atualizarImagens(slides, centerSlide, roomIdx);
          animando = false;
          setBusy(false);
        }, DUR_SLIDE_MS);
      }

      atualizarImagens(slides, centerSlide, roomIdx);
      aplicarSlides(slides, centerSlide);
      preencherCopy(copyInner, roomIdx);

      prevBtn.addEventListener('click', function () {
        ir(-1);
      });
      nextBtn.addEventListener('click', function () {
        ir(1);
      });
    }

    function whenQuartosShowcaseVisible(root, onReady) {
      if (typeof IntersectionObserver === 'undefined') {
        onReady();
        return;
      }
      var io = new IntersectionObserver(
        function (entries, observer) {
          for (var e = 0; e < entries.length; e++) {
            if (entries[e].isIntersecting) {
              observer.disconnect();
              onReady();
              return;
            }
          }
        },
        { root: null, rootMargin: '200px 0px 200px 0px', threshold: 0 }
      );
      io.observe(root);
    }

    document.querySelectorAll('[data-quartos-showcase]').forEach(function (root) {
      whenQuartosShowcaseVisible(root, function () {
        initRoot(root);
      });
    });
  };
})(window);
