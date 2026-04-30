(function () {
  document.addEventListener('DOMContentLoaded', function () {
    var intro = document.getElementById('intro');
    if (!intro) return;

    var btn = document.getElementById('intro-menu-toggle');
    var scrim = document.getElementById('intro-menu-scrim');
    var nav = document.getElementById('intro-nav-principal');
    if (!btn || !nav) return;

    function setOpen(open) {
      intro.classList.toggle('intro-nav-aberto', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.setAttribute('aria-label', open ? 'Fechar menu de navegação' : 'Abrir menu de navegação');
      document.body.classList.toggle('intro-menu-aberto-no-body', open);
      if (scrim) scrim.setAttribute('aria-hidden', open ? 'false' : 'true');
    }

    btn.addEventListener('click', function () {
      setOpen(!intro.classList.contains('intro-nav-aberto'));
    });

    if (scrim) {
      scrim.addEventListener('click', function () {
        setOpen(false);
      });
    }

    nav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        setOpen(false);
      });
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && intro.classList.contains('intro-nav-aberto')) {
        setOpen(false);
      }
    });
  });
})();
