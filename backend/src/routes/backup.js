// Backup API routes — pg_dump based backup system
const express = require('express');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

module.exports = function(broadcastTable) {
  const router = express.Router();

  const BACKUP_DIR = process.env.BACKUP_DIR || path.resolve(__dirname, '../../backups');

  // Ensure backup directory exists
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  // Build pg_dump connection args from env
  function getPgArgs() {
    const args = [];
    const connStr = process.env.DATABASE_URL;

    if (connStr) {
      // Parse connection string
      try {
        const url = new URL(connStr);
        args.push('-h', url.hostname);
        args.push('-p', url.port || '5432');
        args.push('-U', url.username);
        args.push('-d', url.pathname.replace('/', ''));
      } catch {
        // Fallback
        args.push('-d', 'kwanza_erp');
      }
    } else {
      args.push('-h', process.env.PGHOST || '127.0.0.1');
      args.push('-p', process.env.PGPORT || '5432');
      args.push('-U', process.env.PGUSER || 'postgres');
      args.push('-d', process.env.PGDATABASE || 'kwanza_erp');
    }
    return args;
  }

  // POST /api/backup — Trigger manual backup
  router.post('/', async (req, res) => {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = `kwanza_erp_${timestamp}.sql`;
      const filepath = path.join(BACKUP_DIR, filename);

      const pgArgs = [...getPgArgs(), '--format=plain', '--no-owner', '--no-acl', '-f', filepath];

      // Set PGPASSWORD env for pg_dump
      const env = { ...process.env };
      if (process.env.DATABASE_URL) {
        try {
          const url = new URL(process.env.DATABASE_URL);
          env.PGPASSWORD = decodeURIComponent(url.password);
        } catch { /* use env fallback */ }
      }
      if (!env.PGPASSWORD) {
        env.PGPASSWORD = process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD || '';
      }

      await new Promise((resolve, reject) => {
        execFile('pg_dump', pgArgs, { env, timeout: 120000 }, (error, stdout, stderr) => {
          if (error) {
            console.error('[BACKUP ERROR]', stderr || error.message);
            reject(new Error(stderr || error.message));
          } else {
            resolve();
          }
        });
      });

      const stats = fs.statSync(filepath);
      console.log(`[BACKUP] Created: ${filename} (${(stats.size / 1024).toFixed(1)} KB)`);

      res.json({
        success: true,
        filename,
        size: stats.size,
        path: filepath,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[BACKUP ERROR]', error.message);
      res.status(500).json({ error: `Backup failed: ${error.message}` });
    }
  });

  // GET /api/backup — List available backups
  router.get('/', async (req, res) => {
    try {
      const files = fs.readdirSync(BACKUP_DIR)
        .filter(f => f.endsWith('.sql'))
        .map(f => {
          const stats = fs.statSync(path.join(BACKUP_DIR, f));
          return {
            filename: f,
            size: stats.size,
            createdAt: stats.birthtime.toISOString(),
          };
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      res.json(files);
    } catch (error) {
      res.status(500).json({ error: 'Failed to list backups' });
    }
  });

  // GET /api/backup/:filename — Download a specific backup
  router.get('/:filename', async (req, res) => {
    try {
      const { filename } = req.params;
      // Sanitize filename to prevent path traversal
      const safe = path.basename(filename);
      const filepath = path.join(BACKUP_DIR, safe);

      if (!fs.existsSync(filepath)) {
        return res.status(404).json({ error: 'Backup not found' });
      }

      res.download(filepath, safe);
    } catch (error) {
      res.status(500).json({ error: 'Failed to download backup' });
    }
  });

  // DELETE /api/backup/:filename — Delete a backup
  router.delete('/:filename', async (req, res) => {
    try {
      const { filename } = req.params;
      const safe = path.basename(filename);
      const filepath = path.join(BACKUP_DIR, safe);

      if (!fs.existsSync(filepath)) {
        return res.status(404).json({ error: 'Backup not found' });
      }

      fs.unlinkSync(filepath);
      console.log(`[BACKUP] Deleted: ${safe}`);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete backup' });
    }
  });

  // POST /api/backup/restore — Restore from a backup file
  router.post('/restore/:filename', async (req, res) => {
    try {
      const { filename } = req.params;
      const safe = path.basename(filename);
      const filepath = path.join(BACKUP_DIR, safe);

      if (!fs.existsSync(filepath)) {
        return res.status(404).json({ error: 'Backup not found' });
      }

      const pgArgs = [...getPgArgs(), '-f', filepath];

      const env = { ...process.env };
      if (process.env.DATABASE_URL) {
        try {
          const url = new URL(process.env.DATABASE_URL);
          env.PGPASSWORD = decodeURIComponent(url.password);
        } catch { /* fallback */ }
      }
      if (!env.PGPASSWORD) {
        env.PGPASSWORD = process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD || '';
      }

      await new Promise((resolve, reject) => {
        execFile('psql', pgArgs, { env, timeout: 300000 }, (error, stdout, stderr) => {
          if (error) {
            reject(new Error(stderr || error.message));
          } else {
            resolve();
          }
        });
      });

      console.log(`[BACKUP] Restored: ${safe}`);
      res.json({ success: true, filename: safe });
    } catch (error) {
      res.status(500).json({ error: `Restore failed: ${error.message}` });
    }
  });

  return router;
};
