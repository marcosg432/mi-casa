'use strict';

var path = require('path');
var express = require('express');

var BLOCKED_DIR_PREFIXES = [
  '/server',
  '/supabase',
  '/scripts',
  '/deploy',
  '/lib',
  '/node_modules',
  '/data'
];

var BLOCKED_EXACT = new Set([
  '/package.json',
  '/package-lock.json',
  '/ecosystem.config.cjs',
  '/server.js',
  '/.env',
  '/.env.example',
  '/.gitignore',
  '/readme.md',
  '/deploy-hostinger.md',
  '/producao-setup.md'
]);

var PUBLIC_HTML = new Set([
  'index.html',
  'quartos.html',
  'galeria.html',
  'sobre.html',
  'reservar.html',
  'reservar-mesa.html',
  'login.html',
  'painel.html',
  'painel-mesas.html'
]);

var PUBLIC_ROOT_FILES = new Set(['manifest.json', 'sw.js']);

var PUBLIC_STATIC_DIRS = ['css', 'js', 'imagem', 'icons', 'assets'];

var SENSITIVE_EXT = /\.(md|sql|cjs|mjs|sh|example|config|lock|env)$/i;

function deny(res) {
  res.status(403);
  res.setHeader('Cache-Control', 'no-store');
  res.end();
}

function blockSensitivePaths(req, res, next) {
  if (req.path.startsWith('/api/')) return next();

  var raw = req.path || '/';
  var decoded;
  try {
    decoded = decodeURIComponent(raw);
  } catch (e) {
    return deny(res);
  }

  if (decoded.indexOf('..') !== -1 || decoded.indexOf('\\') !== -1) {
    return deny(res);
  }

  var normalized = decoded.replace(/\/+/g, '/').toLowerCase();
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }

  if (normalized === '/' || normalized === '') {
    return next();
  }

  if (normalized === '/.git' || normalized.indexOf('/.git/') === 0) {
    return deny(res);
  }
  if (normalized === '/.env' || normalized.indexOf('/.env') === 0) {
    return deny(res);
  }

  for (var i = 0; i < BLOCKED_DIR_PREFIXES.length; i++) {
    var prefix = BLOCKED_DIR_PREFIXES[i];
    if (normalized === prefix || normalized.indexOf(prefix + '/') === 0) {
      return deny(res);
    }
  }

  if (BLOCKED_EXACT.has(normalized)) {
    return deny(res);
  }

  var base = path.basename(normalized);
  if (!base || base === '.' || base === '..') {
    return deny(res);
  }

  if (SENSITIVE_EXT.test(base)) {
    return deny(res);
  }

  if (base === 'package.json' || base === 'package-lock.json' || base === 'server.js') {
    return deny(res);
  }

  next();
}

function setPublicCacheHeaders(res, filePath) {
  if (/\.html?$/i.test(filePath)) {
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    return;
  }
  if (/\.(js|css)$/i.test(filePath)) {
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    return;
  }
  if (/\.(webp|png|jpe?g|gif|svg|ico|woff2?|mp4|webm)$/i.test(filePath)) {
    res.setHeader('Cache-Control', 'public, max-age=604800');
  }
}

function configurePublicStatic(app, root) {
  var staticOpts = {
    index: false,
    dotfiles: 'deny',
    fallthrough: false,
    setHeaders: setPublicCacheHeaders
  };

  PUBLIC_STATIC_DIRS.forEach(function (dir) {
    app.use(
      '/' + dir,
      express.static(path.join(root, dir), staticOpts)
    );
  });

  app.get('/', function (req, res) {
    res.sendFile(path.join(root, 'index.html'));
  });

  app.get('/index.html', function (req, res) {
    res.sendFile(path.join(root, 'index.html'));
  });

  PUBLIC_HTML.forEach(function (file) {
    if (file === 'index.html') return;
    app.get('/' + file, function (req, res) {
      res.sendFile(path.join(root, file));
    });
  });

  PUBLIC_ROOT_FILES.forEach(function (file) {
    app.get('/' + file, function (req, res) {
      res.sendFile(path.join(root, file));
    });
  });

  app.use(function (req, res) {
    if (req.method === 'GET' || req.method === 'HEAD') {
      res.status(404).end();
      return;
    }
    res.status(405).end();
  });
}

module.exports = {
  blockSensitivePaths: blockSensitivePaths,
  configurePublicStatic: configurePublicStatic,
  PUBLIC_HTML: PUBLIC_HTML,
  PUBLIC_STATIC_DIRS: PUBLIC_STATIC_DIRS
};
