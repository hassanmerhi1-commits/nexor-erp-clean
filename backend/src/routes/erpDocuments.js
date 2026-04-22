// ERP Documents API — central document chain (Proforma → Fatura → Recibo)
const express = require('express');
const db = require('../db');

module.exports = function(broadcastTable) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    try {
      const { branchId, type } = req.query;
      const where = [];
      const params = [];
      if (branchId) { params.push(branchId); where.push(`branch_id = $${params.length}`); }
      if (type) { params.push(type); where.push(`document_type = $${params.length}`); }
      const sql = `SELECT * FROM erp_documents${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC`;
      const { rows } = await db.query(sql, params);
      res.json(rows);
    } catch (err) {
      console.error('[ERP DOCS] list error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/:id', async (req, res) => {
    try {
      const { rows } = await db.query('SELECT * FROM erp_documents WHERE id = $1', [req.params.id]);
      if (!rows[0]) return res.status(404).json({ error: 'Not found' });
      res.json(rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.post('/', async (req, res) => {
    const d = req.body || {};
    if (!d.id || !d.document_type) {
      return res.status(400).json({ error: 'id and document_type are required' });
    }
    try {
      const sql = `
        INSERT INTO erp_documents (
          id, document_type, document_number, branch_id, branch_name,
          entity_type, entity_name, entity_nif, entity_address, entity_phone, entity_email,
          entity_id, entity_code, payment_condition, account_code,
          lines_json, subtotal, total_discount, total_tax, total, currency,
          payment_method, amount_paid, amount_due,
          parent_document_id, parent_document_number, parent_document_type,
          status, issue_date, issue_time, due_date, valid_until,
          notes, internal_notes, terms_and_conditions,
          created_by, created_by_name, confirmed_by, confirmed_at,
          child_documents_json
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
          $16::jsonb,$17,$18,$19,$20,$21,$22,$23,$24,
          $25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,
          $40::jsonb
        )
        ON CONFLICT (id) DO UPDATE SET
          document_type = EXCLUDED.document_type,
          document_number = EXCLUDED.document_number,
          branch_id = EXCLUDED.branch_id,
          branch_name = EXCLUDED.branch_name,
          entity_type = EXCLUDED.entity_type,
          entity_name = EXCLUDED.entity_name,
          entity_nif = EXCLUDED.entity_nif,
          entity_address = EXCLUDED.entity_address,
          entity_phone = EXCLUDED.entity_phone,
          entity_email = EXCLUDED.entity_email,
          entity_id = EXCLUDED.entity_id,
          entity_code = EXCLUDED.entity_code,
          payment_condition = EXCLUDED.payment_condition,
          account_code = EXCLUDED.account_code,
          lines_json = EXCLUDED.lines_json,
          subtotal = EXCLUDED.subtotal,
          total_discount = EXCLUDED.total_discount,
          total_tax = EXCLUDED.total_tax,
          total = EXCLUDED.total,
          currency = EXCLUDED.currency,
          payment_method = EXCLUDED.payment_method,
          amount_paid = EXCLUDED.amount_paid,
          amount_due = EXCLUDED.amount_due,
          parent_document_id = EXCLUDED.parent_document_id,
          parent_document_number = EXCLUDED.parent_document_number,
          parent_document_type = EXCLUDED.parent_document_type,
          status = EXCLUDED.status,
          issue_date = EXCLUDED.issue_date,
          issue_time = EXCLUDED.issue_time,
          due_date = EXCLUDED.due_date,
          valid_until = EXCLUDED.valid_until,
          notes = EXCLUDED.notes,
          internal_notes = EXCLUDED.internal_notes,
          terms_and_conditions = EXCLUDED.terms_and_conditions,
          confirmed_by = EXCLUDED.confirmed_by,
          confirmed_at = EXCLUDED.confirmed_at,
          child_documents_json = EXCLUDED.child_documents_json,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *`;
      const params = [
        d.id, d.document_type, d.document_number || '',
        d.branch_id || null, d.branch_name || null,
        d.entity_type || null, d.entity_name || null, d.entity_nif || null,
        d.entity_address || null, d.entity_phone || null, d.entity_email || null,
        d.entity_id || null, d.entity_code || null,
        d.payment_condition || null, d.account_code || null,
        JSON.stringify(d.lines_json ? (typeof d.lines_json === 'string' ? JSON.parse(d.lines_json) : d.lines_json) : []),
        Number(d.subtotal || 0), Number(d.total_discount || 0), Number(d.total_tax || 0), Number(d.total || 0),
        d.currency || 'AOA', d.payment_method || null,
        Number(d.amount_paid || 0), Number(d.amount_due || 0),
        d.parent_document_id || null, d.parent_document_number || null, d.parent_document_type || null,
        d.status || 'draft', d.issue_date || null, d.issue_time || null,
        d.due_date || null, d.valid_until || null,
        d.notes || null, d.internal_notes || null, d.terms_and_conditions || null,
        d.created_by || null, d.created_by_name || null,
        d.confirmed_by || null, d.confirmed_at || null,
        d.child_documents_json
          ? JSON.stringify(typeof d.child_documents_json === 'string' ? JSON.parse(d.child_documents_json) : d.child_documents_json)
          : null,
      ];
      const { rows } = await db.query(sql, params);
      try { await broadcastTable && broadcastTable('erp_documents'); } catch {}
      res.status(201).json(rows[0]);
    } catch (err) {
      console.error('[ERP DOCS] save error:', err);
      res.status(500).json({ error: err.message || 'Failed to save document' });
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      await db.query('DELETE FROM erp_documents WHERE id = $1', [req.params.id]);
      try { await broadcastTable && broadcastTable('erp_documents'); } catch {}
      res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  return router;
};
