/**
 * NEXOR ERP — Company File (.nexor) routes
 * ----------------------------------------
 * The .nexor file IS the company. One file per branch / per company.
 *
 * Endpoints:
 *   GET    /api/company-file/info               -> active file metadata
 *   POST   /api/company-file/export             -> create SOYO-YYYY-MM-DD.nexor
 *   GET    /api/company-file/list               -> all .nexor files on disk
 *   GET    /api/company-file/download/:name     -> stream a .nexor file
 *   DELETE /api/company-file/:name              -> remove a .nexor file
 *   POST   /api/company-file/restore/:name      -> restore a .nexor (admin)
 *   POST   /api/company-file/open-readonly      -> mount a .nexor as
 *                                                 traveler snapshot
 *
 * All operations use pg_dump / psql under the hood. No new format —
 * a .nexor file is just a PostgreSQL plain-SQL dump with the NEXOR
 * extension and a small header comment for branding.
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const traveler = require('../traveler');

module.exports = function companyFileRoutes() {
  const router = express.Router();

  // Per the NSIS installer, company files live under C:\NEXOR\CompanyFiles
  // On non-Windows dev machines we fall back to ./company-files inside the
  // backend folder so the feature still works for local devs.
  const COMPANY_FILES_DIR =
    process.env.NEXOR_COMPANY_FILES_DIR ||
    (process.platform === 'win32'
      ? 'C:\\NEXOR\\CompanyFiles'
      : path.resolve(__dirname, '../../company-files'));

  if (!fs.existsSync(COMPANY_FILES_DIR)) {
    fs.mkdirSync(COMPANY_FILES_DIR, { recursive: true });
  }

  // ---------- helpers ----------

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
      } catch {
        /* fall through */
      }
    }
    if (!env.PGPASSWORD) {
      env.PGPASSWORD =
        process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD || 'yel3an7azi';
    }
    if (!env.PGHOST) env.PGHOST = process.env.PGHOST || '127.0.0.1';
    if (!env.PGPORT) env.PGPORT = process.env.PGPORT || '5432';
    if (!env.PGUSER) env.PGUSER = process.env.PGUSER || 'postgres';
    if (!env.PGDATABASE) env.PGDATABASE = process.env.PGDATABASE || 'kwanza_erp';
    return env;
  }

  function safeName(input) {
    // Strip path segments + only allow safe chars
    const base = path.basename(String(input || ''));
    return base.replace(/[^A-Za-z0-9._-]/g, '_');
  }

  function nexorHeader(branchLabel) {
    return [
      '-- ========================================================',
      '--  NEXOR ERP — Company File (.nexor)',
      `--  Branch / Company: ${branchLabel}`,
      `--  Exported: ${new Date().toISOString()}`,
      '--  Format: PostgreSQL plain-SQL dump (pg_dump --format=plain)',
      '--  DO NOT EDIT MANUALLY. Restore via NEXOR ERP Settings.',
      '-- ========================================================',
      '',
    ].join('\n');
  }

  // ---------- GET /info ----------
  router.get('/info', (req, res) => {
    res.json({
      directory: COMPANY_FILES_DIR,
      readOnlyMode: process.env.NEXOR_READ_ONLY === '1',
      activeSnapshot: process.env.NEXOR_ACTIVE_SNAPSHOT || null,
      database: getPgEnv().PGDATABASE,
      traveler: traveler.getStatus(),
    });
  });

  // ---------- GET / (list) ----------
  router.get('/', (req, res) => {
    try {
      const files = fs
        .readdirSync(COMPANY_FILES_DIR)
        .filter((f) => f.toLowerCase().endsWith('.nexor'))
        .map((f) => {
          const stats = fs.statSync(path.join(COMPANY_FILES_DIR, f));
          return {
            filename: f,
            size: stats.size,
            createdAt: stats.birthtime.toISOString(),
            modifiedAt: stats.mtime.toISOString(),
          };
        })
        .sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt));
      res.json(files);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ---------- POST /export ----------
  router.post('/export', async (req, res) => {
    if (process.env.NEXOR_READ_ONLY === '1') {
      return res
        .status(403)
        .json({ error: 'Cannot export from a read-only snapshot.' });
    }
    try {
      const branchLabel = safeName(req.body?.branchLabel || 'COMPANY');
      const ts = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const filename = `${branchLabel.toUpperCase()}-${ts}.nexor`;
      const filepath = path.join(COMPANY_FILES_DIR, filename);
      const tmpDump = `${filepath}.tmp`;

      const env = getPgEnv();
      const args = [
        '-h', env.PGHOST,
        '-p', env.PGPORT,
        '-U', env.PGUSER,
        '-d', env.PGDATABASE,
        '--format=plain',
        '--no-owner',
        '--no-acl',
        '-f', tmpDump,
      ];

      await new Promise((resolve, reject) => {
        execFile('pg_dump', args, { env, timeout: 180000 }, (err, _so, se) => {
          if (err) return reject(new Error(se || err.message));
          resolve();
        });
      });

      // Prepend NEXOR header so the file is self-identifying
      const dumpBody = fs.readFileSync(tmpDump, 'utf8');
      fs.writeFileSync(filepath, nexorHeader(branchLabel) + dumpBody, 'utf8');
      fs.unlinkSync(tmpDump);

      const stats = fs.statSync(filepath);
      console.log(
        `[NEXOR] Exported ${filename} (${(stats.size / 1024).toFixed(1)} KB)`,
      );
      res.json({
        success: true,
        filename,
        size: stats.size,
        path: filepath,
        branchLabel,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[NEXOR EXPORT ERROR]', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ---------- GET /download/:filename ----------
  router.get('/download/:filename', (req, res) => {
    const safe = safeName(req.params.filename);
    const filepath = path.join(COMPANY_FILES_DIR, safe);
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'Company file not found' });
    }
    res.download(filepath, safe);
  });

  // ---------- DELETE /:filename ----------
  router.delete('/:filename', (req, res) => {
    if (process.env.NEXOR_READ_ONLY === '1') {
      return res.status(403).json({ error: 'Read-only snapshot.' });
    }
    const safe = safeName(req.params.filename);
    const filepath = path.join(COMPANY_FILES_DIR, safe);
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'Company file not found' });
    }
    fs.unlinkSync(filepath);
    console.log(`[NEXOR] Deleted ${safe}`);
    res.json({ success: true });
  });

  // ---------- POST /restore/:filename ----------
  // Destructive: overwrites the live kwanza_erp database with the snapshot.
  // Requires a confirmation token in the body to avoid accidental clicks.
  router.post('/restore/:filename', async (req, res) => {
    if (process.env.NEXOR_READ_ONLY === '1') {
      return res.status(403).json({ error: 'Read-only snapshot.' });
    }
    const { confirm } = req.body || {};
    if (confirm !== 'I UNDERSTAND THIS REPLACES ALL DATA') {
      return res
        .status(400)
        .json({ error: 'Missing or invalid confirmation token' });
    }
    const safe = safeName(req.params.filename);
    const filepath = path.join(COMPANY_FILES_DIR, safe);
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'Company file not found' });
    }

    try {
      const env = getPgEnv();
      const args = [
        '-h', env.PGHOST,
        '-p', env.PGPORT,
        '-U', env.PGUSER,
        '-d', env.PGDATABASE,
        '-f', filepath,
      ];
      await new Promise((resolve, reject) => {
        execFile('psql', args, { env, timeout: 600000 }, (err, _so, se) => {
          if (err) return reject(new Error(se || err.message));
          resolve();
        });
      });
      console.log(`[NEXOR] Restored ${safe}`);
      res.json({ success: true, filename: safe });
    } catch (err) {
      console.error('[NEXOR RESTORE ERROR]', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};