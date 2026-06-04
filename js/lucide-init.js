/**
 * Inicialização Lucide — Mi Casa, Su Casa
 * CDN: unpkg.com/lucide (carregar antes deste script)
 */
(function (global) {
  /** @lucide/lab — gem-ring (anel de casamento) */
  var gemRing = [
    ['path', { d: 'M13.2 8.1 16 4.4 14.4 2H9.6L8 4.4l2.8 3.7', key: 'srrhiz' }],
    ['circle', { cx: '12', cy: '15', r: '7', key: '14w87o' }]
  ];

  function getIcons() {
    return Object.assign({}, global.lucide.icons, { gemRing: gemRing });
  }

  function createIcons(root) {
    if (!global.lucide || typeof global.lucide.createIcons !== 'function') return;
    var options = {
      icons: getIcons(),
      nameAttr: 'data-lucide',
      attrs: { 'aria-hidden': 'true' }
    };
    if (root) options.root = root;
    global.lucide.createIcons(options);
  }

  function refreshLucideIcons(root) {
    createIcons(root || null);
  }

  global.refreshLucideIcons = refreshLucideIcons;

  function boot() {
    createIcons();
    document.dispatchEvent(new CustomEvent('lucide-ready'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
