// PostgreSQL Database Connection
const { Pool } = require('pg');

function createPoolConfig(overrideDb) {
  const connectionString = process.env.DATABASE_URL?.trim();

  if (connectionString && !overrideDb) {
    return { connectionString };
  }

  // When overrideDb is set we honour the rest of the connection but
  // point to a different database (used by Traveler / Read-Only mode).
  let host = process.env.PGHOST || '127.0.0.1';
  let port = Number(process.env.PGPORT || 5432);
  let user = process.env.PGUSER || 'postgres';
  let password = String(process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD || 'yel3an7azi');
  let database = overrideDb || process.env.PGDATABASE || 'kwanza_erp';

  if (connectionString && overrideDb) {
    try {
      const url = new URL(connectionString);
      host = url.hostname || host;
      port = Number(url.port || port);
      user = url.username || user;
      password = decodeURIComponent(url.password || password);
    } catch { /* keep defaults */ }
  }

  return { host, port, database, user, password };
}

let activePool = new Pool(createPoolConfig());
let activeDatabase = process.env.PGDATABASE || 'kwanza_erp';

if (!process.env.DATABASE_URL) {
  console.log('[DB] DATABASE_URL not set, using local PostgreSQL defaults');
}

// Test connection
activePool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('[DB ERROR] Cannot connect to PostgreSQL:', err.message);
  } else {
    console.log('[DB] Connected to PostgreSQL at', res.rows[0].now);
  }
});

/**
 * Swap the active pool to point at a different database (e.g. the
 * Traveler read-only snapshot). Safe to call repeatedly — drains the old pool.
 * Pass `null` to revert to the default DB defined by env.
 */
async function setActiveDatabase(dbName) {
  const target = dbName || process.env.PGDATABASE || 'kwanza_erp';
  if (target === activeDatabase) return target;
  const old = activePool;
  activePool = new Pool(createPoolConfig(dbName ? target : null));
  activeDatabase = target;
  // Drain previous pool without blocking callers
  old.end().catch((e) => console.warn('[DB] Pool drain warn:', e.message));
  console.log(`[DB] Active database swapped → ${target}`);
  return target;
}

function getActiveDatabase() {
  return activeDatabase;
}

module.exports = {
  query: (text, params) => activePool.query(text, params),
  get pool() { return activePool; },
  setActiveDatabase,
  getActiveDatabase,
};
