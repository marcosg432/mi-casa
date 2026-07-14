'use strict';

var rateLimit = require('express-rate-limit');

/**
 * Limite específico para POST /api/auth/login — proteção contra brute force.
 * 10 tentativas falhas por IP a cada 15 minutos (sucesso não conta).
 */
var loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Muitas tentativas de login. Aguarde 15 minutos e tente novamente.'
  }
});

module.exports = { loginLimiter: loginLimiter };
