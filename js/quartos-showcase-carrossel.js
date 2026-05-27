/**
 * Carrossel 3D da secção Quartos (index e páginas com [data-quartos-showcase]).
 */
(function (global) {
  function definirQuartoAtivoNoForm(root, roomIdx) {
    var L = global.QUARTOS_SITE || [];
    var q = L[roomIdx];
    var id = q && q.id != null ? String(q.id) : '';
    root.setAttribute('data-quarto-ativo', id);
    var secQuartos = root.closest('.secao.secao-quartos');
    if (!secQuartos) return;
    var el = secQuartos.nextElementSibling;
    while (el) {
      if (el.classList && el.classList.contains('secao-reserva')) {
        var hid = el.querySelector('input.form-reserva-quarto-id[type="hidden"]');
        if (hid) hid.value = id;
        break;
      }
      el = el.nextElementSibling;
    }
  }

  function initRoot(root) {
    if (typeof global.mountQuartosShowcase !== 'function') return;
    var ctrl = global.mountQuartosShowcase(root, {
      getLista: function () {
        return global.QUARTOS_SITE || [];
      },
      onActiveRoomChange: function (roomIdx) {
        definirQuartoAtivoNoForm(root, roomIdx);
      }
    });
    if (ctrl) root._quartosShowcaseCtrl = ctrl;
  }

  global.initQuartosShowcaseCarrossel = function initQuartosShowcaseCarrossel() {
    function whenVisible(root, onReady) {
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
        { root: null, rootMargin: '280px 0px 280px 0px', threshold: 0 }
      );
      io.observe(root);
    }

    document.querySelectorAll('[data-quartos-showcase]').forEach(function (root) {
      if (root.dataset.quartosShowcaseBound === 'true') return;
      root.dataset.quartosShowcaseBound = 'true';
      whenVisible(root, function () {
        initRoot(root);
      });
    });
  };

  global.refreshQuartosShowcaseCarrossel = function refreshQuartosShowcaseCarrossel() {
    document.querySelectorAll('[data-quartos-showcase]').forEach(function (root) {
      if (root._quartosShowcaseCtrl && typeof root._quartosShowcaseCtrl.refresh === 'function') {
        root._quartosShowcaseCtrl.refresh();
      }
    });
  };
})(window);
