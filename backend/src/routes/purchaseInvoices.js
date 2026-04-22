// Purchase Invoices API — single source of truth in PostgreSQL
const express = require('express');
const db = require('../db');

module.exports = function(broadcastTable) {
  const router = express.Router();

  // List
  router.get('/', async (req, res) => {
    try {
      const { branchId } = req.query;
      const params = [];
      let sql = 'SELECT * FROM purchase_invoices';
      if (branchId) { sql += ' WHERE branch_id = $1'; params.push(branchId); }
      sql += ' ORDER BY created_at DESC';
      const result = await db.query(sql, params);
      res.json(result.rows);
    } catch (err) {
      console.error('[PURCHASE INVOICES] list error:', err);
      res.status(500).json({ error: err.message || 'Failed to fetch purchase invoices' });
    }
  });

  // Get one
  router.get('/:id', async (req, res) => {
    try {
      const { rows } = await db.query('SELECT * FROM purchase_invoices WHERE id = $1', [req.params.id]);
      if (!rows[0]) return res.status(404).json({ error: 'Not found' });
      res.json(rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Upsert (insert if new, update if exists)
  router.post('/', async (req, res) => {
    const d = req.body || {};
    if (!d.id || !d.invoice_number) {
      return res.status(400).json({ error: 'id and invoice_number are required' });
    }
    try {
      const sql = `
        INSERT INTO purchase_invoices (
          id, invoice_number, supplier_account_code, supplier_name, supplier_nif, supplier_phone,
          supplier_balance, ref, supplier_invoice_no, contact, department, ref2,
          date, payment_date, project, currency, warehouse_id, warehouse_name, price_type,
          address, purchase_account_code, iva_account_code, transaction_type, currency_rate,
          tax_rate_2, order_no, surcharge_percent, change_price, is_pending, extra_note,
          lines_json, journal_lines_json, subtotal, iva_total, total, status,
          branch_id, branch_name, created_by, created_by_name
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
          $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31::jsonb,$32::jsonb,$33,$34,$35,$36,
          $37,$38,$39,$40
        )
        ON CONFLICT (id) DO UPDATE SET
          invoice_number = EXCLUDED.invoice_number,
          supplier_account_code = EXCLUDED.supplier_account_code,
          supplier_name = EXCLUDED.supplier_name,
          supplier_nif = EXCLUDED.supplier_nif,
          supplier_phone = EXCLUDED.supplier_phone,
          supplier_balance = EXCLUDED.supplier_balance,
          ref = EXCLUDED.ref,
          supplier_invoice_no = EXCLUDED.supplier_invoice_no,
          contact = EXCLUDED.contact,
          department = EXCLUDED.department,
          ref2 = EXCLUDED.ref2,
          date = EXCLUDED.date,
          payment_date = EXCLUDED.payment_date,
          project = EXCLUDED.project,
          currency = EXCLUDED.currency,
          warehouse_id = EXCLUDED.warehouse_id,
          warehouse_name = EXCLUDED.warehouse_name,
          price_type = EXCLUDED.price_type,
          address = EXCLUDED.address,
          purchase_account_code = EXCLUDED.purchase_account_code,
          iva_account_code = EXCLUDED.iva_account_code,
          transaction_type = EXCLUDED.transaction_type,
          currency_rate = EXCLUDED.currency_rate,
          tax_rate_2 = EXCLUDED.tax_rate_2,
          order_no = EXCLUDED.order_no,
          surcharge_percent = EXCLUDED.surcharge_percent,
          change_price = EXCLUDED.change_price,
          is_pending = EXCLUDED.is_pending,
          extra_note = EXCLUDED.extra_note,
          lines_json = EXCLUDED.lines_json,
          journal_lines_json = EXCLUDED.journal_lines_json,
          subtotal = EXCLUDED.subtotal,
          iva_total = EXCLUDED.iva_total,
          total = EXCLUDED.total,
          status = EXCLUDED.status,
          branch_id = EXCLUDED.branch_id,
          branch_name = EXCLUDED.branch_name,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *`;
      const params = [
        d.id, d.invoice_number, d.supplier_account_code || '', d.supplier_name || '',
        d.supplier_nif || null, d.supplier_phone || null, Number(d.supplier_balance || 0),
        d.ref || null, d.supplier_invoice_no || null, d.contact || null,
        d.department || null, d.ref2 || null,
        d.date || null, d.payment_date || null, d.project || null,
        d.currency || 'AOA', d.warehouse_id || null, d.warehouse_name || null,
        d.price_type || 'last_price', d.address || null,
        d.purchase_account_code || '2.1.1', d.iva_account_code || '3.3.1',
        d.transaction_type || 'ALL', Number(d.currency_rate || 1),
        Number(d.tax_rate_2 || 0), d.order_no || null,
        Number(d.surcharge_percent || 0),
        d.change_price === true || d.change_price === 1,
        d.is_pending === true || d.is_pending === 1,
        d.extra_note || null,
        JSON.stringify(d.lines_json ? (typeof d.lines_json === 'string' ? JSON.parse(d.lines_json) : d.lines_json) : []),
        JSON.stringify(d.journal_lines_json ? (typeof d.journal_lines_json === 'string' ? JSON.parse(d.journal_lines_json) : d.journal_lines_json) : []),
        Number(d.subtotal || 0), Number(d.iva_total || 0), Number(d.total || 0),
        d.status || 'draft', d.branch_id || null, d.branch_name || null,
        d.created_by || null, d.created_by_name || null,
      ];
      const { rows } = await db.query(sql, params);
      try { await broadcastTable && broadcastTable('purchase_invoices'); } catch {}
      res.status(201).json(rows[0]);
    } catch (err) {
      console.error('[PURCHASE INVOICES] save error:', err);
      res.status(500).json({ error: err.message || 'Failed to save purchase invoice' });
    }
  });

  // Delete
  router.delete('/:id', async (req, res) => {
    try {
      await db.query('DELETE FROM purchase_invoices WHERE id = $1', [req.params.id]);
      try { await broadcastTable && broadcastTable('purchase_invoices'); } catch {}
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
