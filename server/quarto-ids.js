'use strict';

/** IDs antigos do site → catálogo actual (tem-tem, soco, sabia, ararajuba). */
var LEGACY_QUARTO_MAP = {
  'triplo-superior': 'tem-tem',
  'suite-confort': 'soco',
  'suite-premium': 'sabia',
  'quarto-familia': 'ararajuba'
};

function normalizeQuartoId(raw) {
  var s = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
  s = s.replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (!s) return null;
  return LEGACY_QUARTO_MAP[s] || s;
}

function mesmoQuarto(a, b) {
  var na = normalizeQuartoId(a);
  var nb = normalizeQuartoId(b);
  if (!na || !nb) return false;
  return na === nb;
}

module.exports = {
  LEGACY_QUARTO_MAP: LEGACY_QUARTO_MAP,
  normalizeQuartoId: normalizeQuartoId,
  mesmoQuarto: mesmoQuarto
};
