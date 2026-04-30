'use strict';

const path = require('path');
const express = require('express');

const app = express();
const root = path.join(__dirname);
const PORT = Number(process.env.PORT) || 3013;

app.disable('x-powered-by');
app.use(express.static(root, { index: 'index.html' }));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Mi Casa Su Casa — http://0.0.0.0:${PORT}`);
});
