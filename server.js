'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const { getGoogleReviews } = require('./server/google-reviews-api');
const { config, assertProductionConfig } = require('./server/config');
const { requireAuthPage } = require('./server/middleware/require-auth');
const authRoutes = require('./server/routes/auth');
const publicApiRoutes = require('./server/routes/public-api');
const adminApiRoutes = require('./server/routes/admin-api');

try {
  assertProductionConfig();
} catch (e) {
  console.error('[config]', e.message);
  console.warn('[config] Servidor continua — verifique o .env quando possível.');
}

const app = express();
const root = path.join(__dirname);
const PORT = config.port;
const QUARTOS_IMG_ROOT = path.join(root, 'imagem', 'imagem quartos');
const IMG_EXT = new Set(['.webp', '.jpg', '.jpeg', '.png', '.gif']);

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(cookieParser());
app.use(express.json({ limit: '256kb' }));

var globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', globalLimiter);

app.use('/api/auth', authRoutes);
app.use('/api', publicApiRoutes);
app.use('/api/admin', adminApiRoutes);

function ordenarArquivosQuarto(a, b) {
  var aWeb = /(?:^|_)web\./i.test(a) || /^quarto/i.test(a);
  var bWeb = /(?:^|_)web\./i.test(b) || /^quarto/i.test(b);
  if (aWeb !== bWeb) return aWeb ? -1 : 1;
  return a.localeCompare(b, 'pt');
}

function listQuartosImagensPorPasta() {
  var map = {};
  if (!fs.existsSync(QUARTOS_IMG_ROOT)) return map;
  fs.readdirSync(QUARTOS_IMG_ROOT, { withFileTypes: true }).forEach(function (dirent) {
    if (!dirent.isDirectory()) return;
    var id = dirent.name;
    var folder = path.join(QUARTOS_IMG_ROOT, id);
    var files = fs
      .readdirSync(folder)
      .filter(function (f) {
        return IMG_EXT.has(path.extname(f).toLowerCase());
      })
      .sort(ordenarArquivosQuarto);
    map[id] = files.map(function (f) {
      return 'imagem/imagem quartos/' + id + '/' + f;
    });
  });
  return map;
}

app.get('/api/quartos-imagens', function (req, res) {
  try {
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.json(listQuartosImagensPorPasta());
  } catch (err) {
    console.error('[api/quartos-imagens]', err);
    res.status(500).json({ error: 'Não foi possível listar imagens dos quartos.' });
  }
});

app.get('/api/google-reviews', async function (req, res) {
  try {
    const data = await getGoogleReviews();
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json(data);
  } catch (err) {
    console.error('[api/google-reviews]', err);
    res.status(500).json({ error: 'Não foi possível carregar avaliações.' });
  }
});

if (config.disablePanelAuth) {
  console.warn('[painel] Autenticação desativada (DISABLE_PANEL_AUTH) — reative antes de expor o painel.');
} else {
  app.get('/painel.html', requireAuthPage, function (req, res) {
    res.sendFile(path.join(root, 'painel.html'));
  });
  app.get('/painel-mesas.html', requireAuthPage, function (req, res) {
    res.sendFile(path.join(root, 'painel-mesas.html'));
  });
}

function sendNoCacheFile(relativePath) {
  return function (req, res) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.join(root, relativePath));
  };
}

app.get('/reservar.html', sendNoCacheFile('reservar.html'));
app.get('/reservar-mesa.html', sendNoCacheFile('reservar-mesa.html'));
app.get('/js/reservar-flow.js', sendNoCacheFile('js/reservar-flow.js'));
app.get('/js/mesa-reserva-flow.js', sendNoCacheFile('js/mesa-reserva-flow.js'));
app.get('/js/reservar.js', sendNoCacheFile('js/reservar.js'));

app.use(express.static(root, {
  index: 'index.html',
  maxAge: '1h',
  setHeaders: function (res, filePath) {
    if (/\.html?$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
      return;
    }
    if (/\.(js|css)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
      return;
    }
    if (/\.(webp|png|jpe?g|gif|svg|ico|woff2?)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=604800');
    }
  }
}));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Mi Casa, Su Casa — http://0.0.0.0:${PORT}`);
  if (!process.env.GOOGLE_PLACES_API_KEY) {
    console.warn('[google-reviews] GOOGLE_PLACES_API_KEY não definida — usando avaliações de exemplo.');
  }
});
