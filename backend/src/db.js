// PostgreSQL Database Connection
const { Pool } = require('pg');

function createPoolConfig() {
  const connectionString = process.env.DATABASE_URL?.trim();

  if (connectionString) {
    return { connectionString };
  }

  return {
    host: process.env.PGHOST || '127.0.0.1',
    port: Number(process.env.PGPORT || 5432),
    database: process.env.PGDATABASE || 'kwanza_erp',
    user: process.env.PGUSER || 'postgres',
    password: String(process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD || 'yel3an7azi'),
  };
}

const poolConfig = createPoolConfig();
const pool = new Pool(poolConfig);

if (!process.env.DATABASE_URL) {
  console.log('[DB] DATABASE_URL not set, using local PostgreSQL defaults');
}

// Test connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('[DB ERROR] Cannot connect to PostgreSQL:', err.message);
  } else {
    console.log('[DB] Connected to PostgreSQL at', res.rows[0].now);
  }
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
