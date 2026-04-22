/**
 * NEXOR ERP — Branch Sync (Push / Receive Sales)
 * ----------------------------------------------
 * Dolly-style end-of-day exchange between a branch PC and the
 * head-office PC.
 *
 *   Branch PC                          Head Office
 *   --------                           -----------
 *   POST /export-sales   ───►  .dat file  ───►  POST /receive-sales
 *
 * The branch produces a small JSON envelope containing every
 * sale in a date window. The head office imports each sale
 * through the central Transaction Engine (`processSale`), so
 * stock is deducted, journals are posted and open items are
 * created exactly as if the sale had happened locally.
 *
 * Idempotency: every exported sale carries a `sync_uuid`. Re-
 * importing the same envelope is a no-op — duplicates are
 * detected via the unique index added in migration 016.
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('../db');
const { processSale } = require('../transactionEngine');

const ENVELOPE_VERSION = 1;

module.exports = function branchSyncRoutes(broadcastTable) {
  const router = express.Router();

  // Where exported .dat files are saved on the local PC.
  // Same root as the .nexor company files for consistency.
  const SYNC_DIR =
    process.env.NEXOR_BRANCH_SYNC_DIR ||
    (process.platform === 'win32'
      ? 'C:\\NEXOR\\BranchSync'
      : path.resolve(__dirname, '../../branch-sync'));

  if (!fs.existsSync(SYNC_DIR)) {
    fs.mkdirSync(SYNC_DIR, { recursive: true });
  }

  function safeName(s) {
    return path.basename(String(s || '')).replace(/[^A-Za-z0-9._-]/g, '_');
  }

  function sha256Hex(buf) {
    return crypto.createHash('sha256').update(buf).digest('hex');
  }

  // ---------- GET /info ----------
  router.get('/info', (req, res) => {
    res.json({
      directory: SYNC_DIR,
      envelopeVersion: ENVELOPE_VERSION,
      readOnlyMode: process.env.NEXOR_READ_ONLY === '1',
    });
  });

  // ---------- GET / (list local .dat files) ----------
  router.get('/', (req, res) => {
    try {
      const files = fs
        .readdirSync(SYNC_DIR)
        .filter((f) => f.toLowerCase().endsWith('.dat'))
        .map((f) => {
          const stats = fs.statSync(path.join(SYNC_DIR, f));
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

  // ---------- POST /export-sales ----------
  // Run on the BRANCH PC at end of day. Produces a portable
  // .dat file with every sale in [from, to] that has not yet
  // been pushed (or all sales in window if force=true).
  router.post('/export-sales', async (req, res) => {
    try {
      const branchLabel = safeName(req.body?.branchLabel || 'BRANCH');
      const from = req.body?.from || new Date().toISOString().slice(0, 10);
      const to = req.body?.to || from;
      const force = !!req.body?.force;

      // Stamp a sync_uuid on any sale that doesn't have one yet
      await db.query(
        `UPDATE sales SET sync_uuid = gen_random_uuid()
         WHERE sync_uuid IS NULL
           AND DATE(created_at) BETWEEN $1::date AND $2::date`,
        [from, to],
      );

      // Pull sales + their items
      const where = force
        ? `DATE(s.created_at) BETWEEN $1::date AND $2::date`
        : `DATE(s.created_at) BETWEEN $1::date AND $2::date AND COALESCE(s.synced_to_main, false) = false`;

      const salesResult = await db.query(
        `SELECT s.* FROM sales s
         WHERE ${where}
         ORDER BY s.created_at ASC`,
        [from, to],
      );

      if (salesResult.rows.length === 0) {
        return res.status(200).json({
          success: true,
          message: 'No sales to export in this window.',
          count: 0,
        });
      }

      const saleIds = salesResult.rows.map((r) => r.id);
      const itemsResult = await db.query(
        `SELECT * FROM sale_items WHERE sale_id = ANY($1::uuid[])`,
        [saleIds],
      );
      const itemsBySale = new Map();
      for (const it of itemsResult.rows) {
        if (!itemsBySale.has(it.sale_id)) itemsBySale.set(it.sale_id, []);
        itemsBySale.get(it.sale_id).push(it);
      }

      const envelope = {
        nexor: 'branch-sales-export',
        version: ENVELOPE_VERSION,
        branchLabel,
        exportedAt: new Date().toISOString(),
        windowFrom: from,
        windowTo: to,
        count: salesResult.rows.length,
        sales: salesResult.rows.map((s) => ({
          syncUuid: s.sync_uuid,
          invoiceNumber: s.invoice_number,
          branchId: s.branch_id,
          cashierId: s.cashier_id,
          cashierName: s.cashier_name,
          subtotal: Number(s.subtotal),
          taxAmount: Number(s.tax_amount),
          discount: Number(s.discount || 0),
          total: Number(s.total),
          paymentMethod: s.payment_method,
          amountPaid: Number(s.amount_paid),
          change: Number(s.change || 0),
          customerNif: s.customer_nif,
          customerName: s.customer_name,
          createdAt: s.created_at,
          items: (itemsBySale.get(s.id) || []).map((it) => ({
            productId: it.product_id,
            productName: it.product_name,
            sku: it.sku,
            quantity: Number(it.quantity),
            unitPrice: Number(it.unit_price),
            discount: Number(it.discount || 0),
            taxRate: Number(it.tax_rate),
            taxAmount: Number(it.tax_amount),
            subtotal: Number(it.subtotal),
          })),
        })),
      };

      // Sign the envelope so we detect tampering at receive time
      const body = Buffer.from(JSON.stringify(envelope.sales));
      envelope.checksum = sha256Hex(body);

      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = `${branchLabel.toUpperCase()}-SALES-${ts}.dat`;
      const filepath = path.join(SYNC_DIR, filename);
      fs.writeFileSync(filepath, JSON.stringify(envelope, null, 2), 'utf8');

      // Mark exported sales — they become read-only on the branch
      await db.query(
        `UPDATE sales SET synced_at = NOW(), synced_to_main = true
         WHERE id = ANY($1::uuid[])`,
        [saleIds],
      );

      const stats = fs.statSync(filepath);
      console.log(
        `[BRANCH SYNC] Exported ${salesResult.rows.length} sales → ${filename} (${(stats.size / 1024).toFixed(1)} KB)`,
      );
      res.json({
        success: true,
        filename,
        size: stats.size,
        path: filepath,
        count: salesResult.rows.length,
        windowFrom: from,
        windowTo: to,
        branchLabel,
      });
    } catch (err) {
      console.error('[BRANCH SYNC EXPORT ERROR]', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ---------- POST /receive-sales ----------
  // Run on the HEAD OFFICE PC. Accepts an envelope (either
  // posted as JSON in the body, or referenced by `filename` of
  // a .dat file already in BranchSync/) and runs each sale
  // through `processSale` so stock + accounting stay consistent.
  router.post('/receive-sales', async (req, res) => {
    if (process.env.NEXOR_READ_ONLY === '1') {
      return res
        .status(403)
        .json({ error: 'Read-only snapshot — cannot receive sales.' });
    }
    try {
      let envelope = req.body?.envelope;
      let sourceFile = null;

      if (!envelope && req.body?.filename) {
        sourceFile = path.join(SYNC_DIR, safeName(req.body.filename));
        if (!fs.existsSync(sourceFile)) {
          return res.status(404).json({ error: 'File not found in BranchSync folder' });
        }
        envelope = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
      }

      if (!envelope || envelope.nexor !== 'branch-sales-export') {
        return res
          .status(400)
          .json({ error: 'Invalid envelope: not a NEXOR branch-sales-export.' });
      }
      if (envelope.version !== ENVELOPE_VERSION) {
        return res.status(400).json({
          error: `Envelope version ${envelope.version} not supported (expected ${ENVELOPE_VERSION}).`,
        });
      }

      // Verify checksum
      const expected = sha256Hex(Buffer.from(JSON.stringify(envelope.sales)));
      if (envelope.checksum && envelope.checksum !== expected) {
        return res.status(400).json({ error: 'Checksum mismatch — file appears corrupted.' });
      }

      const summary = {
        accepted: 0,
        skippedDuplicate: 0,
        failed: [],
        totalAmount: 0,
      };

      for (const s of envelope.sales) {
        // Idempotency: skip if a sale with this sync_uuid already exists
        if (s.syncUuid) {
          const dup = await db.query(
            `SELECT 1 FROM sales WHERE sync_uuid = $1 LIMIT 1`,
            [s.syncUuid],
          );
          if (dup.rows.length > 0) {
            summary.skippedDuplicate++;
            continue;
          }
        }

        const client = await db.pool.connect();
        try {
          await client.query('BEGIN');
          // Run through the central engine — stock + journals + open items
          // get the same treatment as a locally-entered sale.
          const result = await processSale(client, {
            branchId: s.branchId,
            cashierId: s.cashierId,
            cashierName: s.cashierName,
            items: s.items,
            subtotal: s.subtotal,
            taxAmount: s.taxAmount,
            discount: s.discount,
            total: s.total,
            paymentMethod: s.paymentMethod,
            amountPaid: s.amountPaid,
            change: s.change,
            customerNif: s.customerNif,
            customerName: s.customerName,
            // The branch already has its own invoice number — reuse it
            // unless it collides on the head office side, in which case
            // processSale would throw and we'd let it fail loudly below.
            invoiceNumber: s.invoiceNumber,
          });

          // Stamp the sync metadata on the newly created sale
          await client.query(
            `UPDATE sales
               SET sync_uuid = $1,
                   sync_origin_branch = $2,
                   sync_received_at = NOW()
             WHERE id = $3`,
            [s.syncUuid, envelope.branchLabel || null, result.id],
          );
          await client.query('COMMIT');

          summary.accepted++;
          summary.totalAmount += Number(s.total) || 0;
        } catch (err) {
          await client.query('ROLLBACK').catch(() => {});
          summary.failed.push({
            invoiceNumber: s.invoiceNumber,
            syncUuid: s.syncUuid,
            error: err.message,
          });
        } finally {
          client.release();
        }
      }

      // Broadcast so the dashboard refreshes
      try {
        if (typeof broadcastTable === 'function') {
          broadcastTable('sales');
          broadcastTable('stock_movements');
        }
      } catch (_) {}

      console.log(
        `[BRANCH SYNC] Received from ${envelope.branchLabel}: ` +
          `${summary.accepted} accepted, ${summary.skippedDuplicate} duplicates, ${summary.failed.length} failed`,
      );

      res.json({
        success: true,
        branchLabel: envelope.branchLabel,
        windowFrom: envelope.windowFrom,
        windowTo: envelope.windowTo,
        sourceFile: sourceFile ? path.basename(sourceFile) : null,
        ...summary,
      });
    } catch (err) {
      console.error('[BRANCH SYNC RECEIVE ERROR]', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ---------- GET /download/:filename ----------
  router.get('/download/:filename', (req, res) => {
    const safe = safeName(req.params.filename);
    const filepath = path.join(SYNC_DIR, safe);
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    res.download(filepath, safe);
  });

  // ---------- DELETE /:filename ----------
  router.delete('/:filename', (req, res) => {
    const safe = safeName(req.params.filename);
    const filepath = path.join(SYNC_DIR, safe);
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    fs.unlinkSync(filepath);
    res.json({ success: true });
  });

  return router;
};