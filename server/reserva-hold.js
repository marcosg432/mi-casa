'use strict';

var HOLD_DAYS = 3;
var HOLD_MS = HOLD_DAYS * 24 * 60 * 60 * 1000;

function reservaBloqueiaDatas(row) {
  if (!row) return false;
  var status = String(row.status || '').toLowerCase();
  return status === 'confirmada' || status === 'ativa';
}

module.exports = {
  HOLD_DAYS: HOLD_DAYS,
  HOLD_MS: HOLD_MS,
  reservaBloqueiaDatas: reservaBloqueiaDatas
};
