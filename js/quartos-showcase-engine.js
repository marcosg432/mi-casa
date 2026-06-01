/**
 * Motor do carrossel 3D de quartos: 3 cards visíveis (quartos diferentes),
 * autoplay de fotos só no card ativo (20s), estado isolado por quarto.
 */
(function (global) {
  var AUTOPLAY_FOTO_MS = 20000;
  var DUR_SLIDE_MS = 900;

  function fotosDoQuarto(q) {
    if (!q) return [];
    if (typeof global.quartoImagensDoCatalogo === 'function') {
      return global.quartoImagensDoCatalogo(q);
    }
    var img = String(q.img || '').trim();
    return img ? [img] : [];
  }

  function indicesVisiveis(activeIdx, n) {
    if (n <= 0) return [];
    if (n === 1) return [0];
    return [(activeIdx - 1 + n) % n, activeIdx, (activeIdx + 1) % n];
  }

  /** off 0 = centro (ativo), 1 = direita (próximo), 2 = esquerda (anterior). */
  function indiceQuartoNoSlide(centerSlide, slideIdx, activeRoomIdx, n) {
    var off = (slideIdx - centerSlide + 3) % 3;
    if (off === 0) return activeRoomIdx;
    if (off === 1) return (activeRoomIdx + 1) % n;
    return (activeRoomIdx - 1 + n) % n;
  }

  /**
   * @param {HTMLElement} root
   * @param {object} opts
   * @param {function(): Array} opts.getLista
   * @param {number} [opts.initialRoomIdx]
   * @param {function(number)} [opts.onRoomChange]
   * @param {function(number)} [opts.onActiveRoomChange] — texto/form
   */
  global.mountQuartosShowcase = function mountQuartosShowcase(root, opts) {
    opts = opts || {};
    var getLista = opts.getLista || function () {
      return global.QUARTOS_SITE || [];
    };

    var slides = root.querySelectorAll('.quartos-3d-slide');
    if (slides.length !== 3) return null;

    var copyInner = root.querySelector('.quartos-showcase-copy-inner');
    var prevBtn = root.querySelector('.quartos-showcase-nav--prev');
    var nextBtn = root.querySelector('.quartos-showcase-nav--next');
    var visual = root.querySelector('.quartos-showcase-visual');
    if (!copyInner || !prevBtn || !nextBtn || !visual) return null;

    var dotsWrap = visual.querySelector('.quartos-showcase-fotos-dots');
    if (!dotsWrap) {
      dotsWrap = document.createElement('div');
      dotsWrap.className = 'quartos-showcase-fotos-dots';
      dotsWrap.setAttribute('role', 'tablist');
      dotsWrap.setAttribute('aria-label', 'Fotos do quarto');
      visual.appendChild(dotsWrap);
    }

    var richMotion = true;
    try {
      richMotion = !global.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (eM) {}

    var IMG_SIZES_HINT = '(max-width: 768px) 52vw, min(480px, 42vw)';

    /** @type {Record<string, { photoIdx: number, timer: number|null }>} */
    var estados = {};

    var roomIdx =
      typeof opts.initialRoomIdx === 'number' && opts.initialRoomIdx >= 0 ? opts.initialRoomIdx : 0;
    var centerSlide = 0;
    var animando = false;
    var hoverPausado = false;

    function lista() {
      return getLista() || [];
    }

    function idDoIndice(ri) {
      var q = lista()[ri];
      return q && q.id != null ? String(q.id) : '';
    }

    function garantirEstado(roomId) {
      if (!roomId) return { photoIdx: 0, timer: null };
      if (!estados[roomId]) estados[roomId] = { photoIdx: 0, timer: null };
      return estados[roomId];
    }

    function pararTimer(roomId) {
      var st = estados[roomId];
      if (!st || !st.timer) return;
      clearTimeout(st.timer);
      st.timer = null;
    }

    function pararTodosTimers() {
      Object.keys(estados).forEach(pararTimer);
    }

    function resetarQuarto(roomId) {
      if (!roomId) return;
      pararTimer(roomId);
      garantirEstado(roomId).photoIdx = 0;
    }

    function sincronizarResetForaDaVista(activeIdx) {
      var L = lista();
      var n = L.length;
      if (!n) return;
      var vis = {};
      indicesVisiveis(activeIdx, n).forEach(function (ri) {
        var id = idDoIndice(ri);
        if (id) vis[id] = true;
      });
      Object.keys(estados).forEach(function (id) {
        if (!vis[id]) resetarQuarto(id);
      });
    }

    function aplicarPosicoesSlides() {
      for (var i = 0; i < slides.length; i++) {
        slides[i].classList.remove('pos-esquerda', 'pos-centro', 'pos-direita');
        if (i === centerSlide) slides[i].classList.add('pos-centro');
        else if (i === (centerSlide + 1) % 3) slides[i].classList.add('pos-direita');
        else slides[i].classList.add('pos-esquerda');
      }
    }

    function normalizarSrcImagem(src) {
      return typeof global.quartoUrlImagem === 'function'
        ? global.quartoUrlImagem(src)
        : String(src || '').trim();
    }

    function definirImgNoSlide(slideEl, src, alt, eager) {
      var img = slideEl.querySelector('img');
      if (!img || !src) return;
      src = normalizarSrcImagem(src);
      img.alt = alt;
      img.sizes = IMG_SIZES_HINT;
      img.decoding = 'async';
      img.loading = eager ? 'eager' : 'lazy';
      img.onerror = function onImgErr() {
        img.onerror = null;
        try {
          img.src = encodeURI(src);
        } catch (eEnc) {
          img.src = src;
        }
      };
      img.src = src;
    }

    function aplicarImgQuartoNoSlide(slideDomIdx, ri, eager) {
      var L = lista();
      var q = L[ri];
      if (!q) return;
      var roomId = idDoIndice(ri);
      var st = garantirEstado(roomId);
      var imgs = fotosDoQuarto(q);
      if (!imgs.length) return;
      var pi = Math.min(st.photoIdx, imgs.length - 1);
      var altBase = q.alt || q.titulo || 'Quarto';
      var alt = imgs.length > 1 ? altBase + ' — foto ' + (pi + 1) : altBase;
      definirImgNoSlide(slides[slideDomIdx], imgs[pi], alt, eager);
      slides[slideDomIdx].dataset.quartoId = roomId;
    }

    function renderizarSlides() {
      var L = lista();
      var n = L.length;
      if (!n) return;
      if (roomIdx >= n) roomIdx = 0;

      for (var i = 0; i < slides.length; i++) {
        var ri = indiceQuartoNoSlide(centerSlide, i, roomIdx, n);
        var q = L[ri];
        if (!q) continue;
        var roomId = idDoIndice(ri);
        var st = garantirEstado(roomId);
        var imgs = fotosDoQuarto(q);
        if (!imgs.length) continue;
        var pi = Math.min(st.photoIdx, imgs.length - 1);
        if (st.photoIdx !== pi) st.photoIdx = pi;
        var altBase = q.alt || q.titulo || 'Quarto';
        var alt = imgs.length > 1 ? altBase + ' — foto ' + (pi + 1) : altBase;
        var isCentro = i === centerSlide;
        definirImgNoSlide(slides[i], imgs[pi], alt, isCentro);
        slides[i].dataset.quartoId = roomId;
      }
      renderizarBolinhas();
    }

    function renderizarBolinhas() {
      var q = lista()[roomIdx];
      if (!q) return;
      var roomId = idDoIndice(roomIdx);
      var st = garantirEstado(roomId);
      var imgs = fotosDoQuarto(q);
      dotsWrap.innerHTML = '';
      if (imgs.length <= 1) {
        dotsWrap.hidden = true;
        return;
      }
      dotsWrap.hidden = false;
      for (var d = 0; d < imgs.length; d++) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'quartos-showcase-foto-dot' + (d === st.photoIdx ? ' is-active' : '');
        btn.setAttribute('role', 'tab');
        btn.setAttribute('aria-label', 'Foto ' + (d + 1) + ' de ' + imgs.length);
        btn.setAttribute('aria-selected', d === st.photoIdx ? 'true' : 'false');
        (function (idx) {
          btn.addEventListener('click', function () {
            irParaFoto(idx);
          });
        })(d);
        dotsWrap.appendChild(btn);
      }
    }

    function preencherCopy() {
      var q = lista()[roomIdx];
      if (!q) return;
      var tit = copyInner.querySelector('.quartos-showcase-titulo');
      var desc = copyInner.querySelector('.quartos-showcase-desc');
      var precoVal = copyInner.querySelector('.quartos-showcase-preco-valor');
      if (tit) tit.textContent = q.titulo;
      if (desc) desc.textContent = q.desc;
      if (precoVal) precoVal.textContent = q.preco;
      var lbl = copyInner.querySelector('.quartos-showcase-preco-label');
      if (lbl) lbl.textContent = q.precoLabel || 'Noite';
      var a = copyInner.querySelector('.quartos-showcase-btn');
      if (a) {
        a.href = q.verQuartoHref || 'quartos.html#quarto-' + encodeURIComponent(String(q.id || ''));
      }
      root.setAttribute('data-quarto-ativo', String(q.id || ''));
      if (typeof opts.onActiveRoomChange === 'function') opts.onActiveRoomChange(roomIdx);
    }

    function animarTexto() {
      if (!richMotion) {
        preencherCopy();
        return;
      }
      copyInner.classList.add('quartos-copy--saida');
      setTimeout(function () {
        preencherCopy();
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

    function agendarAutoplayAtivo() {
      var roomId = idDoIndice(roomIdx);
      pararTimer(roomId);
      if (!richMotion || hoverPausado || document.hidden || animando) return;
      var q = lista()[roomIdx];
      var imgs = fotosDoQuarto(q);
      if (imgs.length <= 1) return;

      var st = garantirEstado(roomId);
      st.timer = setTimeout(function () {
        st.timer = null;
        if (idDoIndice(roomIdx) !== roomId || animando || hoverPausado || document.hidden) return;
        avancarFotoAtiva(1);
        agendarAutoplayAtivo();
      }, AUTOPLAY_FOTO_MS);
    }

    function iniciarAutoplayAtivo() {
      pararTodosTimers();
      agendarAutoplayAtivo();
    }

    function avancarFotoAtiva(dir) {
      var L = lista();
      if (!L.length || animando) return;
      var q = L[roomIdx];
      var roomId = idDoIndice(roomIdx);
      var st = garantirEstado(roomId);
      var imgs = fotosDoQuarto(q);
      if (imgs.length <= 1) return;

      animando = true;
      pararTimer(roomId);
      st.photoIdx = (st.photoIdx + dir + imgs.length) % imgs.length;

      var slideCentro = slides[centerSlide];
      var pi = Math.min(st.photoIdx, imgs.length - 1);
      var altBase = q.alt || q.titulo || 'Quarto';
      var alt = imgs.length > 1 ? altBase + ' — foto ' + (pi + 1) : altBase;
      definirImgNoSlide(slideCentro, imgs[pi], alt, true);
      renderizarBolinhas();

      animando = false;
      agendarAutoplayAtivo();
    }

    function irParaFoto(targetIdx) {
      var roomId = idDoIndice(roomIdx);
      var st = garantirEstado(roomId);
      var imgs = fotosDoQuarto(lista()[roomIdx]);
      if (animando || imgs.length <= 1 || targetIdx === st.photoIdx) return;
      pararTimer(roomId);
      var diff = targetIdx - st.photoIdx;
      var dir = diff > 0 ? 1 : -1;
      var steps = Math.abs(diff);
      var s = 0;
      function passo() {
        if (s >= steps) {
          agendarAutoplayAtivo();
          return;
        }
        avancarFotoAtiva(dir);
        s++;
        setTimeout(passo, DUR_SLIDE_MS + 50);
      }
      passo();
    }

    function irQuarto(dir) {
      var L = lista();
      var n = L.length;
      if (animando || n < 2) return;

      var idAntigo = idDoIndice(roomIdx);
      pararTimer(idAntigo);

      var prevVis = indicesVisiveis(roomIdx, n);
      var novoRoomIdx = dir === 1 ? (roomIdx + 1) % n : (roomIdx - 1 + n) % n;
      var nextVis = indicesVisiveis(novoRoomIdx, n);

      prevVis.forEach(function (ri) {
        if (nextVis.indexOf(ri) === -1) resetarQuarto(idDoIndice(ri));
      });

      animando = true;
      setBusy(true);

      var roomAntes = roomIdx;
      if (dir === 1) {
        var slideEntra = (centerSlide + 2) % 3;
        var riEntra = (roomAntes + 2) % n;
        aplicarImgQuartoNoSlide(slideEntra, riEntra, false);
      } else {
        var slideEntraPrev = (centerSlide + 1) % 3;
        var riEntraPrev = (roomAntes - 2 + n) % n;
        aplicarImgQuartoNoSlide(slideEntraPrev, riEntraPrev, false);
      }

      roomIdx = novoRoomIdx;
      centerSlide = dir === 1 ? (centerSlide + 1) % 3 : (centerSlide + 2) % 3;
      aplicarPosicoesSlides();
      animarTexto();

      setTimeout(function () {
        sincronizarResetForaDaVista(roomIdx);
        renderizarSlides();
        animando = false;
        setBusy(false);
        if (typeof opts.onRoomChange === 'function') opts.onRoomChange(roomIdx);
        iniciarAutoplayAtivo();
      }, DUR_SLIDE_MS);
    }

    function refresh() {
      var L = lista();
      if (!L.length) return;
      if (roomIdx >= L.length) roomIdx = 0;
      L.forEach(function (q) {
        if (q && q.id) garantirEstado(String(q.id));
      });
      sincronizarResetForaDaVista(roomIdx);
      renderizarSlides();
      aplicarPosicoesSlides();
      preencherCopy();
      iniciarAutoplayAtivo();
    }

    function destroy() {
      pararTodosTimers();
      estados = {};
    }

    var L0 = lista();
    if (L0.length) {
      L0.forEach(function (q) {
        if (q && q.id) garantirEstado(String(q.id));
      });
      if (roomIdx >= L0.length) roomIdx = 0;
      sincronizarResetForaDaVista(roomIdx);
      renderizarSlides();
      aplicarPosicoesSlides();
      preencherCopy();
      iniciarAutoplayAtivo();
    }

    prevBtn.setAttribute('aria-label', 'Quarto anterior');
    nextBtn.setAttribute('aria-label', 'Próximo quarto');

    prevBtn.addEventListener('click', function () {
      irQuarto(-1);
    });
    nextBtn.addEventListener('click', function () {
      irQuarto(1);
    });

    root.addEventListener('mouseenter', function () {
      hoverPausado = true;
      pararTodosTimers();
    });
    root.addEventListener('mouseleave', function () {
      hoverPausado = false;
      iniciarAutoplayAtivo();
    });

    document.addEventListener('visibilitychange', function onVis() {
      if (document.hidden) pararTodosTimers();
      else iniciarAutoplayAtivo();
    });

    return {
      refresh: refresh,
      destroy: destroy,
      setRoomIdx: function (idx) {
        var L = lista();
        if (!L.length || idx < 0 || idx >= L.length) return;
        pararTodosTimers();
        roomIdx = idx;
        sincronizarResetForaDaVista(roomIdx);
        renderizarSlides();
        aplicarPosicoesSlides();
        preencherCopy();
        iniciarAutoplayAtivo();
      }
    };
  };
})(window);
