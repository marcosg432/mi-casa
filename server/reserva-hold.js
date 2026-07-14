'use strict';

var HOLD_HOURS = 30;
var HOLD_MS = HOLD_HOURS * 60 * 60 * 1000;

function reservaBloqueiaDatas(row) {
  if (!row) return false;
  var status = String(row.status || '').toLowerCase();
  if (status === 'cancelada') return false;
  if (status === 'confirmada' || status === 'ativa') return true;
  if (status === 'pendente') {
    var expires =
      row.hold_expires_at || row.holdExpiresAt;
    if (expires) return new Date(expires).getTime() > Date.now();
    var created = row.created_at || row.criadoEm || row.criado_em;
    if (created) return new Date(created).getTime() + HOLD_MS > Date.now();
    return true;
  }
  return false;
}

module.exports = {
  HOLD_HOURS: HOLD_HOURS,
  HOLD_MS: HOLD_MS,
  reservaBloqueiaDatas: reservaBloqueiaDatas
};
