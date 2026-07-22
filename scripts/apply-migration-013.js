/**
 * Aplica a migration 013 (hold 30h) quando DATABASE_URL ou SUPABASE_DB_URL estiver definida.
 * Uso: DATABASE_URL=postgres://... node scripts/apply-migration-013.js
 *
 * Sem connection string Postgres, a reserva já funciona; só faltam hold_expires_at
 * e a RPC expirar_reservas_pendentes (o servidor tem fallback em JS).
 */
'use strict';

require('dotenv').config();
var fs = require('fs');
var path = require('path');

async function main() {
  var dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || '';
  if (!dbUrl) {
    console.log(
      'Sem DATABASE_URL/SUPABASE_DB_URL — não é possível aplicar DDL automaticamente.\n' +
        'No Dashboard Supabase → SQL Editor, execute o ficheiro:\n' +
        '  supabase/migrations/013_reserva_hold_30h.sql'
    );
    process.exit(0);
  }

  var pg;
  try {
    pg = require('pg');
  } catch (e) {
    console.error('Instale pg: npm install pg');
    process.exit(1);
  }

  var sqlPath = path.join(__dirname, '..', 'supabase', 'migrations', '013_reserva_hold_30h.sql');
  var sql = fs.readFileSync(sqlPath, 'utf8');
  var client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(sql);
    console.log('Migration 013 aplicada com sucesso.');
  } finally {
    await client.end();
  }
}

main().catch(function (err) {
  console.error(err.message || err);
  process.exit(1);
});
