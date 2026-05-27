'use strict';

const fs = require('fs');
const path = require('path');
const express = require('express');
const { getGoogleReviews } = require('./server/google-reviews-api');

const app = express();
const root = path.join(__dirname);
const PORT = Number(process.env.PORT) || 3014;
const QUARTOS_IMG_ROOT = path.join(root, 'imagem', 'imagem quartos');
const IMG_EXT = new Set(['.webp', '.jpg', '.jpeg', '.png', '.gif']);

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

app.disable('x-powered-by');
app.use(express.static(root, { index: 'index.html' }));

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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Mi Casa Su Casa — http://0.0.0.0:${PORT}`);
  if (!process.env.GOOGLE_PLACES_API_KEY) {
    console.warn(
      '[google-reviews] GOOGLE_PLACES_API_KEY não definida — usando avaliações de exemplo.'
    );
  }
});
