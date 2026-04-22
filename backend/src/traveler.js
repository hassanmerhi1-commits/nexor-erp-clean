/**
 * NEXOR ERP — Traveler / Read-Only Mode (Phase 5)
 * -----------------------------------------------
 * Lets an offline user (e.g. an executive on a flight) open a .nexor
 * company file as a fully browsable, fully **read-only** snapshot.
 *
 * How it works:
 *   1. We create a throwaway database on the local PostgreSQL instance
 *      (kwanza_erp_traveler), drop any previous one.
 *   2. We restore the chosen .nexor file into it via psql.
 *   3. We swap the live pg pool to that DB and flip
 *      process.env.NEXOR_READ_ONLY = '1'. The readOnlyGuard middleware
 *      then rejects every write.
 *   4. Unmount → swap pool back to the live DB and DROP the traveler DB.
 *
 * The live company database is never touched.
 */

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { Pool } = require('pg');
const db = require('./db');

const TRAVELER_DB = process.env.NEXOR_TRAVELER_DB || 'kwanza_erp_traveler';

const state = {
  active: false,
  filename: null,
  mountedAt: null,
  database: null,
};

function getPgEnv() {
  const env = { ...process.env };
  if (process.env.DATABASE_URL) {
    try {
      const url = new URL(process.env.DATABASE_URL);
      env.PGPASSWORD = decodeURIComponent(url.password || '');
      env.PGHOST = url.hostname;
      env.PGPORT = url.port || '5432';
      env.PGUSER = url.username;
      env.PGDATABASE = url.pathname.replace(/^\//, '') || 'kwanza_erp';
    } catch { /* noop */ }
  }
  if (!env.PGPASSWORD) {
    env.PGPASSWORD = process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD || 'yel3an7azi';
  }
  env.PGHOST = env.PGHOST || process.env.PGHOST || '127.0.0.1';
  env.PGPORT = env.PGPORT || process.env.PGPORT || '5432';
  env.PGUSER = env.PGUSER || process.env.PGUSER || 'postgres';
  env.PGDATABASE = env.PGDATABASE || process.env.PGDATABASE || 'kwanza_erp';
  return env;
}

/** Run a SQL command against the postgres maintenance DB. */
async function adminExec(sql) {
  const env = getPgEnv();
  const adminPool = new Pool({
    host: env.PGHOST,
    port: Number(env.PGPORT),
    user: env.PGUSER,
    password: env.PGPASSWORD,
    database: 'postgres', // maintenance DB always exists
  });
  try {
    await adminPool.query(sql);
  } finally {
    await adminPool.end().catch(() => {});
  }
}

/** Force-disconnect anyone using a DB so it can be dropped. */
async function terminateConnections(dbName) {
  await adminExec(
    `SELECT pg_terminate_backend(pid) FROM pg_stat_activity
     WHERE datname = '${dbName}' AND pid <> pg_backend_pid();`,
  );
}

function safeName(input) {
  return path.basename(String(input || '')).replace(/[^A-Za-z0-9._-]/g, '_');
}

/** Mount a .nexor file as the read-only traveler database. */
async function mountSnapshot(filepath, filename) {
  if (!fs.existsSync(filepath)) {
    throw new Error('Snapshot file not found');
  }

  // 1. (Re)create the traveler DB
  try {
    await terminateConnections(TRAVELER_DB);
    await adminExec(`DROP DATABASE IF EXISTS ${TRAVELER_DB};`);
  } catch (e) {
    console.warn('[TRAVELER] Drop previous DB warn:', e.message);
  }
  await adminExec(`CREATE DATABASE ${TRAVELER_DB};`);

  // 2. Restore the snapshot into it
  const env = getPgEnv();
  const args = [
    '-h', env.PGHOST,
    '-p', env.PGPORT,
    '-U', env.PGUSER,
    '-d', TRAVELER_DB,
    '-v', 'ON_ERROR_STOP=0',
    '-f', filepath,
  ];
  await new Promise((resolve, reject) => {
    execFile('psql', args, { env, timeout: 600_000 }, (err, _so, se) => {
      if (err) return reject(new Error(se || err.message));
      resolve();
    });
  });

  // 3. Swap pool + flip read-only flag
  await db.setActiveDatabase(TRAVELER_DB);
  process.env.NEXOR_READ_ONLY = '1';
  process.env.NEXOR_ACTIVE_SNAPSHOT = filename;

  state.active = true;
  state.filename = filename;
  state.mountedAt = new Date().toISOString();
  state.database = TRAVELER_DB;

  console.log(`[TRAVELER] Mounted ${filename} → ${TRAVELER_DB} (READ-ONLY)`);
  return { ...state };
}

/** Switch back to the live DB and drop the traveler DB. */
async function unmountSnapshot() {
  // 1. Swap back first so nothing is using the traveler DB
  await db.setActiveDatabase(null);
  process.env.NEXOR_READ_ONLY = '0';
  delete process.env.NEXOR_ACTIVE_SNAPSHOT;

  // 2. Drop the traveler DB (best-effort)
  try {
    await terminateConnections(TRAVELER_DB);
    await adminExec(`DROP DATABASE IF EXISTS ${TRAVELER_DB};`);
  } catch (e) {
    console.warn('[TRAVELER] Cleanup warn:', e.message);
  }

  const previous = { ...state };
  state.active = false;
  state.filename = null;
  state.mountedAt = null;
  state.database = null;

  console.log('[TRAVELER] Unmounted, live DB restored');
  return previous;
}

function getStatus() {
  return {
    ...state,
    readOnly: process.env.NEXOR_READ_ONLY === '1',
    liveDatabase: process.env.PGDATABASE || 'kwanza_erp',
    activeDatabase: db.getActiveDatabase(),
  };
}

module.exports = { mountSnapshot, unmountSnapshot, getStatus, safeName };
