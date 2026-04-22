// Payments API routes — ALL writes through Transaction Engine
const express = require('express');
const db = require('../db');
const { processPayment } = require('../transactionEngine');

module.exports = function(broadcastTable) {
  const router = express.Router();

  // READ
  router.get('/', async (req, res) => {
    try {
      const { entityType, entityId, branchId } = req.query;
      let query = 'SELECT * FROM payments WHERE 1=1';
      const params = [];
      let idx = 1;
      if (entityType) { query += ` AND entity_type = $${idx++}`; params.push(entityType); }
      if (entityId) { query += ` AND entity_id = $${idx++}`; params.push(entityId); }
      if (branchId) { query += ` AND branch_id = $${idx++}`; params.push(branchId); }
      query += ' ORDER BY created_at DESC';
      const result = await db.query(query, params);
      res.json(result.rows);
    } catch (error) {
      console.error('[PAYMENTS ERROR]', error);
      res.status(500).json({ error: 'Failed to fetch payments' });
    }
  });

  // CREATE: Delegated to Transaction Engine
  router.post('/', async (req, res) => {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const payment = await processPayment(client, req.body);
      await client.query('COMMIT');
      await broadcastTable('payments');
      res.status(201).json(payment);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[PAYMENTS ERROR]', error);
      res.status(500).json({ error: error.message || 'Failed to create payment' });
    } finally {
      client.release();
    }
  });

  // READ: Open items
  router.get('/open-items/:entityType/:entityId', async (req, res) => {
    try {
      const { entityType, entityId } = req.params;
      const result = await db.query(
        `SELECT * FROM open_items WHERE entity_type = $1 AND entity_id = $2 AND status != 'cleared' ORDER BY document_date ASC`,
        [entityType, entityId]
      );
      res.json(result.rows);
    } catch (error) {
      console.error('[PAYMENTS ERROR]', error);
      res.status(500).json({ error: 'Failed to fetch open items' });
    }
  });

  // READ: Entity balance
  router.get('/balance/:entityType/:entityId', async (req, res) => {
    try {
      const { entityType, entityId } = req.params;
      const result = await db.query(
        `SELECT * FROM v_entity_balance WHERE entity_type = $1 AND entity_id = $2`,
        [entityType, entityId]
      );
      res.json(result.rows[0] || { balance: 0, open_items_count: 0 });
    } catch (error) {
      console.error('[PAYMENTS ERROR]', error);
      res.status(500).json({ error: 'Failed to fetch balance' });
    }
  });

  // READ: Stock from movements view
  router.get('/stock/:productId/:warehouseId', async (req, res) => {
    try {
      const { productId, warehouseId } = req.params;
      const result = await db.query(
        `SELECT * FROM v_current_stock WHERE product_id = $1 AND warehouse_id = $2`,
        [productId, warehouseId]
      );
      res.json(result.rows[0] || { current_stock: 0 });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch stock' });
    }
  });

  // READ: Document flow
  router.get('/document-flow/:docType/:docId', async (req, res) => {
    try {
      const { docType, docId } = req.params;
      const result = await db.query(
        `SELECT * FROM document_links WHERE (source_type = $1 AND source_id = $2) OR (target_type = $1 AND target_id = $2) ORDER BY created_at ASC`,
        [docType, docId]
      );
      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch document flow' });
    }
  });

  // READ: Periods
  router.get('/periods', async (req, res) => {
    try {
      const result = await db.query('SELECT * FROM accounting_periods ORDER BY year DESC, month DESC');
      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch periods' });
    }
  });

  // Period close (administrative — allowed in route)
  router.post('/periods/:id/close', async (req, res) => {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const { id } = req.params;
      const { closedBy } = req.body;
      await client.query(
        `UPDATE accounting_periods SET status = 'closed', closed_by = $1, closed_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [closedBy, id]
      );
      await client.query('COMMIT');
      res.json({ success: true });
    } catch (error) {
      await client.query('ROLLBACK');
      res.status(500).json({ error: 'Failed to close period' });
    } finally {
      client.release();
    }
  });

  // READ: Stock movements
  router.get('/stock-movements', async (req, res) => {
    try {
      const { productId, warehouseId, referenceType } = req.query;
      let query = 'SELECT sm.*, p.name as product_name, p.sku FROM stock_movements sm JOIN products p ON p.id = sm.product_id WHERE 1=1';
      const params = [];
      let idx = 1;
      if (productId) { query += ` AND sm.product_id = $${idx++}`; params.push(productId); }
      if (warehouseId) { query += ` AND sm.warehouse_id = $${idx++}`; params.push(warehouseId); }
      if (referenceType) { query += ` AND sm.reference_type = $${idx++}`; params.push(referenceType); }
      query += ' ORDER BY sm.created_at DESC LIMIT 500';
      const result = await db.query(query, params);
      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch stock movements' });
    }
  });

  return router;
};
