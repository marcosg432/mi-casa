'use strict';

(function initGoogleReviews() {
  var API_URL = '/api/google-reviews';

  var FALLBACK_SUMMARY = {
    notaMedia: 5.0,
    totalAvaliacoes: null,
    urlMaps:
      'https://www.google.com/maps/search/?api=1&query=' +
      encodeURIComponent('Pousada Mi Casa Su Casa, Benevides, PA')
  };

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getCardImages() {
    var list = window.GOOGLE_REVIEW_CARD_IMAGES;
    return Array.isArray(list) ? list.slice() : [];
  }

  function criarCard(item, isClone) {
    var art = document.createElement('article');
    art.className = 'review-card' + (isClone ? ' review-card--clone' : '');
    if (isClone) art.setAttribute('aria-hidden', 'true');

    if (item.imgCompact) art.classList.add('review-card--img-compact');

    var img = document.createElement('img');
    img.className = 'review-card__img';
    img.src = encodeURI(item.src);
    img.alt = item.alt || 'Avaliação Google — Mi Casa Su Casa';
    img.width = 340;
    img.height = 220;
    img.loading = 'lazy';
    img.decoding = 'async';
    art.appendChild(img);

    return art;
  }

  function distribuirEmLinhas(items, linhas) {
    var rows = [];
    var i;
    for (i = 0; i < linhas; i++) rows[i] = [];
    if (!items.length) return rows;

    var pool = [];
    while (pool.length < linhas * 6) {
      items.forEach(function (r) {
        pool.push(r);
      });
    }

    pool.forEach(function (r, idx) {
      rows[idx % linhas].push(r);
    });

    return rows;
  }

  function preencherTrack(track, items) {
    track.innerHTML = '';
    if (!items.length) return;

    var frag = document.createDocumentFragment();
    items.forEach(function (r) {
      frag.appendChild(criarCard(r, false));
    });
    items.forEach(function (r) {
      frag.appendChild(criarCard(r, true));
    });
    track.appendChild(frag);
  }

  function atualizarDuracao(track, fator) {
    var metade = track.scrollWidth / 2;
    if (!metade) return;
    var pxPorSegundo = 40 * (fator || 1);
    var duracao = Math.max(metade / pxPorSegundo, 30);
    track.style.setProperty('--reviews-duration', duracao + 's');
  }

  function debounce(fn, ms) {
    var t;
    return function () {
      clearTimeout(t);
      var args = arguments;
      var ctx = this;
      t = setTimeout(function () {
        fn.apply(ctx, args);
      }, ms);
    };
  }

  function renderSummary(secao, data) {
    var summary = secao.querySelector('[data-reviews-summary]');
    if (!summary) return;

    if (data.notaMedia == null) {
      summary.hidden = true;
      return;
    }

    summary.hidden = false;
    var scoreEl = secao.querySelector('[data-reviews-score]');
    var countEl = secao.querySelector('[data-reviews-count]');
    if (scoreEl) scoreEl.textContent = '5.0';
    if (countEl) {
      countEl.textContent = data.totalAvaliacoes
        ? data.totalAvaliacoes + ' avaliações no Google'
        : 'Avaliações no Google';
    }
  }

  function atualizarLinkGoogle(secao, data) {
    var link = secao.querySelector('[data-reviews-google-link]');
    if (link && data.urlMaps) link.href = data.urlMaps;
  }

  function buildRows(secao, cards) {
    var rowsWrap = secao.querySelector('[data-reviews-rows]');
    if (!rowsWrap) return;

    var rowEls = rowsWrap.querySelectorAll('[data-reviews-row]');
    var porLinha = distribuirEmLinhas(cards, rowEls.length);
    var fatores = [1, 1.12];

    rowEls.forEach(function (rowEl, idx) {
      var track = rowEl.querySelector('.reviews-track');
      if (!track) return;
      var lista = porLinha[idx] && porLinha[idx].length ? porLinha[idx] : cards;
      preencherTrack(track, lista);
      requestAnimationFrame(function () {
        atualizarDuracao(track, fatores[idx]);
      });
    });
  }

  function setLoading(secao, on) {
    secao.classList.toggle('is-loading', on);
    var loading = secao.querySelector('[data-reviews-loading]');
    if (loading) loading.hidden = !on;
  }

  async function buscarResumo() {
    try {
      var res = await fetch(API_URL, {
        headers: { Accept: 'application/json' },
        cache: 'default'
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } catch (err) {
      return FALLBACK_SUMMARY;
    }
  }

  async function carregar(secao) {
    setLoading(secao, true);
    var cards = getCardImages();
    if (!cards.length) {
      setLoading(secao, false);
      var loading = secao.querySelector('[data-reviews-loading]');
      if (loading) loading.textContent = 'Nenhuma imagem de avaliação encontrada.';
      return;
    }

    var data = await buscarResumo();
    renderSummary(secao, data);
    atualizarLinkGoogle(secao, data);
    buildRows(secao, cards);
    setLoading(secao, false);
  }

  function boot() {
    document.querySelectorAll('[data-google-reviews]').forEach(function (secao) {
      carregar(secao);

      var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
      if (!reduced.matches) {
        window.addEventListener(
          'resize',
          debounce(function () {
            var fatores = [1, 1.12];
            secao.querySelectorAll('.reviews-track').forEach(function (track, idx) {
              atualizarDuracao(track, fatores[idx]);
            });
          }, 150)
        );
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
