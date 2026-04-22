// Purchase Orders API routes — ALL writes through Transaction Engine
const express = require('express');
const db = require('../db');
const { createPurchaseOrder, processPurchaseReceive } = require('../transactionEngine');

module.exports = function(broadcastTable) {
  const router = express.Router();

  // READ: Get all purchase orders (read-only queries are fine in routes)
  router.get('/', async (req, res) => {
    try {
      const { branchId } = req.query;
      let query = 'SELECT * FROM purchase_orders';
      const params = [];
      if (branchId) { query += ' WHERE branch_id = $1'; params.push(branchId); }
      query += ' ORDER BY created_at DESC';
      const result = await db.query(query, params);

      for (let order of result.rows) {
        const itemsResult = await db.query('SELECT * FROM purchase_order_items WHERE order_id = $1', [order.id]);
        order.items = itemsResult.rows;
      }
      res.json(result.rows);
    } catch (error) {
      console.error('[PURCHASE ORDERS ERROR]', error);
      res.status(500).json({ error: 'Failed to fetch purchase orders' });
    }
  });

  // CREATE: Delegated to Transaction Engine
  router.post('/', async (req, res) => {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const order = await createPurchaseOrder(client, req.body);
      await client.query('COMMIT');
      await broadcastTable('purchase_orders');
      res.status(201).json(order);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[PURCHASE ORDERS ERROR]', error);
      res.status(500).json({ error: error.message || 'Failed to create purchase order' });
    } finally {
      client.release();
    }
  });

  // APPROVE: Simple status update (no financial impact — allowed in route)
  router.post('/:id/approve', async (req, res) => {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const { id } = req.params;
      const { approvedBy } = req.body;
      await client.query(
        'UPDATE purchase_orders SET status = $1, approved_by = $2, approved_at = CURRENT_TIMESTAMP WHERE id = $3',
        ['approved', approvedBy, id]
      );
      await client.query('COMMIT');
      await broadcastTable('purchase_orders');
      res.json({ success: true });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[PURCHASE ORDERS ERROR]', error);
      res.status(500).json({ error: error.message || 'Failed to approve order' });
    } finally {
      client.release();
    }
  });

  // RECEIVE: Delegated to Transaction Engine (stock + accounting)
  router.post('/:id/receive', async (req, res) => {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const { id } = req.params;
      const { receivedBy, receivedQuantities } = req.body;

      // Check approval status
      try {
        const approvalResult = await client.query(
          `SELECT status FROM approval_requests WHERE document_type = 'purchase_order' AND document_id = $1 ORDER BY created_at DESC LIMIT 1`,
          [id]
        );
        if (approvalResult.rows.length > 0 && approvalResult.rows[0].status !== 'approved') {
          throw new Error(`Ordem de compra aguarda aprovação (estado: ${approvalResult.rows[0].status})`);
        }
      } catch (e) {
        if (e.message.includes('aguarda aprovação')) throw e;
      }

      await processPurchaseReceive(client, id, receivedQuantities, receivedBy);
      await client.query('COMMIT');
      await broadcastTable('purchase_orders');
      await broadcastTable('products');
      res.json({ success: true });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[PURCHASE ORDERS ERROR]', error);
      res.status(500).json({ error: error.message || 'Failed to receive order' });
    } finally {
      client.release();
    }
  });

  return router;
};
