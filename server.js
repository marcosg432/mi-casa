'use strict';

const path = require('path');
const express = require('express');
const { getGoogleReviews } = require('./server/google-reviews-api');

const app = express();
const root = path.join(__dirname);
const PORT = Number(process.env.PORT) || 3014;

app.disable('x-powered-by');
app.use(express.static(root, { index: 'index.html' }));

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
