/**
 * NEXOR ERP — Auto-Backup API (Phase 4)
 *
 *   GET    /api/auto-backup/status          -> scheduler state + counts
 *   GET    /api/auto-backup/list            -> snapshots on disk
 *   POST   /api/auto-backup/run             -> manual trigger ({ label? })
 *   GET    /api/auto-backup/download/:name  -> stream a snapshot
 *   DELETE /api/auto-backup/:name           -> delete a snapshot
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const auto = require('../autoBackup');

module.exports = function autoBackupRoutes() {
  const router = express.Router();

  router.get('/status', (_req, res) => {
    res.json(auto.getStatus());
  });

  router.get('/list', (_req, res) => {
    try {
      res.json(auto.listSnapshots());
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.post('/run', async (req, res) => {
    try {
      const label = req.body && req.body.label;
      const file = await auto.runBackup({ label, manual: true });
      res.json({ success: true, file });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get('/download/:name', (req, res) => {
    const safe = path.basename(req.params.name);
    const fp = path.join(auto.AUTO_BACKUP_DIR, safe);
    if (!fs.existsSync(fp)) return res.status(404).json({ error: 'Not found' });
    res.download(fp, safe);
  });

  router.delete('/:name', (req, res) => {
    const safe = path.basename(req.params.name);
    const fp = path.join(auto.AUTO_BACKUP_DIR, safe);
    if (!fs.existsSync(fp)) return res.status(404).json({ error: 'Not found' });
    try {
      fs.unlinkSync(fp);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
};
