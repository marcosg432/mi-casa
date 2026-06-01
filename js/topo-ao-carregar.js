(function () {
  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }
  try {
    sessionStorage.removeItem('galeriaScrollPos');
  } catch (e) {}

  function irTopo() {
    try {
      window.scrollTo({ left: 0, top: 0, behavior: 'instant' });
    } catch (err) {
      window.scrollTo(0, 0);
    }
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }

  irTopo();
  window.addEventListener('pageshow', function (e) {
    if (!e.persisted) irTopo();
  });
  window.addEventListener('load', function () {
    requestAnimationFrame(function () {
      if (window.scrollY <= 1) irTopo();
    });
  });

  var buildLocal =
    window.__SITE_BUILD ||
    document.documentElement.getAttribute('data-site-build') ||
    '';
  if (!buildLocal || !window.fetch) return;

  fetch('/api/version', { cache: 'no-store' })
    .then(function (res) {
      return res.ok ? res.json() : null;
    })
    .then(function (data) {
      if (!data || !data.siteBuild || data.siteBuild === buildLocal) return;
      var key = 'mcsc-build-sync';
      if (sessionStorage.getItem(key) === data.siteBuild) return;
      sessionStorage.setItem(key, data.siteBuild);
      var url = new URL(window.location.href);
      url.searchParams.set('v', data.siteBuild);
      window.location.replace(url.toString());
    })
    .catch(function () {});
})();
