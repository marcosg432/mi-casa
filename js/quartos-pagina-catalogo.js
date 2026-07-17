/**
 * Página quartos.html — monta os cartões a partir de window.QUARTOS_SITE.
 */
(function (global) {
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatPrecoDiariaPorPessoa(q) {
    var preco = String((q && q.preco) || '—').trim();
    return preco + ' diária por pessoa';
  }

  function metaIcon(key) {
    var map = {
      'Ar-condicionado': 'air-vent',
      'Wi-Fi': 'wifi',
      'Banheiro': 'shower-head',
      'Cozinha compacta': 'cooking-pot',
      'Máquina de lavar': 'washing-machine',
      'Ventilador': 'fan',
      'Guarda-roupa': 'shirt',
      'Camas': 'bed',
      'Capacidade': 'users',
      'Tamanho': 'ruler',
      'Diária': 'banknote'
    };
    return map[key] || 'circle-dot';
  }

  function metaLista(q) {
    var a = (q && q.amenities) || {};
    var lines = [];
    if (a.arCondicionado) lines.push({ k: 'Ar-condicionado', v: 'sim' });
    if (a.wifi) lines.push({ k: 'Wi-Fi', v: 'gratuito' });
    var idQuarto = String((q && q.id) || '').trim();
    var banheiroPriv =
      !!a.banheiroPrivativo || idQuarto === 'ararajuba' || idQuarto === 'sabia';
    if (banheiroPriv) {
      var banheiroTxt = /su[ií]te/i.test(String((q && q.tipo) || ''))
        ? 'privativo (suíte) — exclusivo deste quarto'
        : 'privativo';
      lines.push({ k: 'Banheiro', v: banheiroTxt });
    } else if (a.banheiroCompartilhado) {
      lines.push({ k: 'Banheiro', v: 'compartilhado' });
    }
    if (a.cozinhaCompacta) lines.push({ k: 'Cozinha compacta', v: 'privativa' });
    if (a.maquinaLavar) lines.push({ k: 'Máquina de lavar', v: 'sim' });
    if (a.ventilador) lines.push({ k: 'Ventilador', v: 'sim' });
    if (a.guardaRoupa) lines.push({ k: 'Guarda-roupa', v: 'sim' });
    var cc = Number(a.camasCasal) || 0;
    var cs = Number(a.camasSolteiro) || 0;
    if (cc > 0 || cs > 0) {
      var partes = [];
      if (cc > 0) partes.push(cc + (cc === 1 ? ' cama de casal' : ' camas de casal'));
      if (cs > 0) partes.push(cs + (cs === 1 ? ' cama de solteiro' : ' camas de solteiro'));
      lines.push({ k: 'Camas', v: partes.join(' · ') });
    }
    if (q.capacidade) lines.push({ k: 'Capacidade', v: 'até ' + q.capacidade + ' pessoas' });
    if (a.metros2) lines.push({ k: 'Tamanho', v: String(a.metros2) + ' m²' });
    lines.push({
      k: 'Diária',
      v: formatPrecoDiariaPorPessoa(q)
    });
    return lines;
  }

  function textoCorpo(q) {
    return String(q.desc || '').trim();
  }

  function quartoImagensLista(q) {
    var id = String((q && q.id) || '').trim();
    if (id && typeof global.quartoImagensDaPasta === 'function') {
      var daPasta = global.quartoImagensDaPasta(id);
      if (daPasta.length) return daPasta.slice();
    }

    var lista = [];
    var principal = String((q && q.img) || '').trim();
    if (principal) lista.push(principal);
    var gal =
      q && q.amenities && Array.isArray(q.amenities.galeria) ? q.amenities.galeria : [];
    gal.forEach(function (src) {
      src = String(src || '').trim();
      if (src && lista.indexOf(src) === -1) lista.push(src);
    });
    return lista;
  }

  global.quartoImagensLista = quartoImagensLista;

  function renderQuartoMedia(q) {
    var imgs = quartoImagensLista(q);
    var altBase = String(q.alt || q.titulo || 'Quarto').trim();

    if (!imgs.length) {
      return '<div class="quarto-modelo-media quarto-modelo-media--vazio" aria-hidden="true"></div>';
    }

    if (imgs.length === 1) {
      return (
        '<div class="quarto-modelo-media">' +
        '<img src="' +
        esc(imgs[0]) +
        '" alt="' +
        esc(altBase) +
        '" width="1280" height="720" loading="lazy" decoding="async">' +
        '</div>'
      );
    }

    var slides = imgs
      .map(function (src, i) {
        var alt = altBase + ' — foto ' + (i + 1);
        return (
          '<div class="swiper-slide">' +
          '<img src="' +
          esc(src) +
          '" alt="' +
          esc(alt) +
          '" width="1280" height="720" loading="' +
          (i === 0 ? 'eager' : 'lazy') +
          '" decoding="async">' +
          '</div>'
        );
      })
      .join('');

    return (
      '<div class="quarto-modelo-media" data-quarto-carrossel>' +
      '<div class="quarto-swiper swiper" aria-label="Fotos do quarto ' +
      esc(q.titulo) +
      '">' +
      '<div class="swiper-wrapper">' +
      slides +
      '</div>' +
      '<div class="quarto-swiper-pagination swiper-pagination" aria-label="Indicador do carrossel — ' +
      imgs.length +
      ' fotos"></div>' +
      '</div></div>'
    );
  }

  global.renderQuartosPaginaCatalogo = function (mountId) {
    var el = document.getElementById(mountId || 'quartos-catalogo-mount');
    if (!el) return;
    var list = global.QUARTOS_SITE || [];
    if (!list.length) {
      el.innerHTML = '<p class="quartos-intro">Nenhum quarto cadastrado.</p>';
      return;
    }
    var html = list
      .map(function (q, idx) {
        var strip = idx % 2 === 0 ? 'verde' : 'branco';
        var invert = idx % 2 === 1 ? ' quarto-modelo-card--invert' : '';
        var lis = metaLista(q)
          .map(function (row) {
            return (
              '<li class="quarto-modelo-meta-item">' +
              '<span class="quarto-modelo-meta-icone" aria-hidden="true">' +
              '<i data-lucide="' +
              esc(metaIcon(row.k)) +
              '" class="lucide-icon"></i>' +
              '</span>' +
              '<span class="quarto-modelo-meta-texto"><strong>' +
              esc(row.k) +
              ':</strong> ' +
              esc(row.v) +
              '</span></li>'
            );
          })
          .join('');
        var id = esc(q.id);
        return (
          '<section class="quartos-secao-strip quartos-secao-strip--' +
          strip +
          '" aria-labelledby="tit-' +
          id +
          '"><div class="container"><article id="quarto-' +
          id +
          '" class="quarto-modelo-card' +
          invert +
          '">' +
          renderQuartoMedia(q) +
          '<div class="quarto-modelo-info"><h3 id="tit-' +
          id +
          '">' +
          esc(q.titulo) +
          '</h3><p class="quarto-modelo-lead">' +
          esc(q.tipo || '') +
          '</p><p class="quarto-modelo-preco">' +
          esc(formatPrecoDiariaPorPessoa(q)) +
          '</p><p>' +
          esc(textoCorpo(q)) +
          '</p><ul class="quarto-modelo-meta">' +
          lis +
          '</ul><a class="btn btn-reserva" href="' +
          esc('reservar.html?quarto=' + encodeURIComponent(q.id)) +
          '">Ver preços</a></div></article></div></section>'
        );
      })
      .join('');
    el.innerHTML = html;

    if (typeof global.refreshLucideIcons === 'function') {
      global.refreshLucideIcons(el);
    }

    if (typeof global.initQuartosCardCarrosseis === 'function') {
      global.initQuartosCardCarrosseis(el);
    }
  };
})(window);
