/**
 * NEXOR ERP — Auto-Backup Safety Net (Phase 4)
 * --------------------------------------------
 * Scheduled pg_dump snapshots written to:
 *   Windows: C:\NEXOR\AutoBackups
 *   Dev:     backend/auto-backups
 *
 * - Runs every BACKUP_INTERVAL_HOURS (default 24h)
 * - First run executes BACKUP_INITIAL_DELAY_MIN after boot (default 5)
 * - Keeps the last BACKUP_RETENTION snapshots (default 14)
 * - Survives errors silently and reports the last status via /api/auto-backup/status
 *
 * No new dependencies — uses pg_dump from the bundled PostgreSQL install.
 */

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const AUTO_BACKUP_DIR =
  process.env.NEXOR_AUTO_BACKUP_DIR ||
  (process.platform === 'win32'
    ? 'C:\\NEXOR\\AutoBackups'
    : path.resolve(__dirname, '../auto-backups'));

const RETENTION = parseInt(process.env.BACKUP_RETENTION || '14', 10);
const INTERVAL_HOURS = parseFloat(process.env.BACKUP_INTERVAL_HOURS || '24');
const INITIAL_DELAY_MIN = parseFloat(process.env.BACKUP_INITIAL_DELAY_MIN || '5');

const state = {
  enabled: process.env.NEXOR_AUTO_BACKUP !== '0',
  running: false,
  lastRunAt: null,
  lastSuccessAt: null,
  lastError: null,
  lastFile: null,
  nextRunAt: null,
  intervalHours: INTERVAL_HOURS,
  retention: RETENTION,
  dir: AUTO_BACKUP_DIR,
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

function ensureDir() {
  if (!fs.existsSync(AUTO_BACKUP_DIR)) {
    fs.mkdirSync(AUTO_BACKUP_DIR, { recursive: true });
  }
}

function listSnapshots() {
  ensureDir();
  return fs
    .readdirSync(AUTO_BACKUP_DIR)
    .filter((f) => f.endsWith('.sql') || f.endsWith('.nexor'))
    .map((f) => {
      const fp = path.join(AUTO_BACKUP_DIR, f);
      const st = fs.statSync(fp);
      return {
        filename: f,
        size: st.size,
        createdAt: st.birthtime.toISOString(),
        path: fp,
      };
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function pruneOld() {
  const snaps = listSnapshots();
  if (snaps.length <= state.retention) return 0;
  const toDelete = snaps.slice(state.retention);
  let removed = 0;
  for (const s of toDelete) {
    try {
      fs.unlinkSync(s.path);
      removed++;
    } catch (e) {
      console.error('[AUTO-BACKUP] Prune failed:', s.filename, e.message);
    }
  }
  if (removed > 0) console.log(`[AUTO-BACKUP] Pruned ${removed} old snapshot(s)`);
  return removed;
}

function buildFilename(label) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const branch = (label || process.env.BRANCH_NAME || 'NEXOR')
    .toString()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '');
  return `${branch}_AUTO_${ts}.sql`;
}

function runBackup({ label, manual = false } = {}) {
  return new Promise((resolve, reject) => {
    if (state.running) {
      return reject(new Error('Auto-backup already running'));
    }
    state.running = true;
    state.lastRunAt = new Date().toISOString();
    ensureDir();

    const filename = buildFilename(label);
    const filepath = path.join(AUTO_BACKUP_DIR, filename);
    const env = getPgEnv();

    const args = [
      '-h', env.PGHOST,
      '-p', env.PGPORT,
      '-U', env.PGUSER,
      '-d', env.PGDATABASE,
      '--format=plain',
      '--no-owner',
      '--no-acl',
      '-f', filepath,
    ];

    console.log(`[AUTO-BACKUP] Starting ${manual ? 'manual' : 'scheduled'} backup → ${filename}`);

    execFile('pg_dump', args, { env, timeout: 180_000 }, (err, _stdout, stderr) => {
      state.running = false;
      if (err) {
        state.lastError = (stderr || err.message || '').toString().slice(0, 500);
        console.error('[AUTO-BACKUP] FAILED:', state.lastError);
        try { fs.existsSync(filepath) && fs.unlinkSync(filepath); } catch { /* noop */ }
        return reject(new Error(state.lastError));
      }

      try {
        // Stamp NEXOR header so any human can identify the file
        const header = `-- NEXOR ERP AutoBackup\n-- Generated: ${new Date().toISOString()}\n-- Branch: ${label || process.env.BRANCH_NAME || 'NEXOR'}\n\n`;
        const original = fs.readFileSync(filepath, 'utf8');
        fs.writeFileSync(filepath, header + original);
      } catch (e) {
        console.warn('[AUTO-BACKUP] Header stamp failed:', e.message);
      }

      const stats = fs.statSync(filepath);
      state.lastSuccessAt = new Date().toISOString();
      state.lastError = null;
      state.lastFile = { filename, size: stats.size, createdAt: state.lastSuccessAt };
      console.log(`[AUTO-BACKUP] OK ${filename} (${(stats.size / 1024).toFixed(1)} KB)`);
      pruneOld();
      resolve(state.lastFile);
    });
  });
}

let timer = null;

function scheduleNext() {
  if (!state.enabled) return;
  const ms = INTERVAL_HOURS * 60 * 60 * 1000;
  state.nextRunAt = new Date(Date.now() + ms).toISOString();
  timer = setTimeout(async () => {
    try { await runBackup(); } catch (_) { /* logged */ }
    scheduleNext();
  }, ms);
  if (timer.unref) timer.unref();
}

function start() {
  if (!state.enabled) {
    console.log('[AUTO-BACKUP] Disabled via NEXOR_AUTO_BACKUP=0');
    return;
  }
  ensureDir();
  const initialMs = INITIAL_DELAY_MIN * 60 * 1000;
  state.nextRunAt = new Date(Date.now() + initialMs).toISOString();
  console.log(`[AUTO-BACKUP] Scheduler armed — first run in ${INITIAL_DELAY_MIN}min, then every ${INTERVAL_HOURS}h, retention=${RETENTION}`);
  const initial = setTimeout(async () => {
    try { await runBackup(); } catch (_) { /* logged */ }
    scheduleNext();
  }, initialMs);
  if (initial.unref) initial.unref();
}

function getStatus() {
  return {
    ...state,
    snapshots: listSnapshots().length,
  };
}

module.exports = { start, runBackup, listSnapshots, getStatus, AUTO_BACKUP_DIR };
