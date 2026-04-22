// Daily Reports API routes
const express = require('express');
const db = require('../db');

module.exports = function(broadcastTable) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    try {
      const { branchId } = req.query;
      let query = 'SELECT * FROM daily_reports';
      const params = [];
      
      if (branchId) {
        query += ' WHERE branch_id = $1';
        params.push(branchId);
      }
      
      query += ' ORDER BY date DESC';
      const result = await db.query(query, params);
      res.json(result.rows);
    } catch (error) {
      console.error('[DAILY REPORTS ERROR]', error);
      res.status(500).json({ error: 'Failed to fetch daily reports' });
    }
  });

  // Generate daily report
  router.post('/generate', async (req, res) => {
    try {
      const { branchId, date } = req.body;
      
      // Get branch info
      const branchResult = await db.query('SELECT * FROM branches WHERE id = $1', [branchId]);
      const branch = branchResult.rows[0];
      
      // Calculate totals from sales
      const salesResult = await db.query(
        `SELECT 
          COUNT(*) as transaction_count,
          COALESCE(SUM(total), 0) as total_sales,
          COALESCE(SUM(tax_amount), 0) as tax_collected,
          COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total ELSE 0 END), 0) as cash_total,
          COALESCE(SUM(CASE WHEN payment_method = 'card' THEN total ELSE 0 END), 0) as card_total,
          COALESCE(SUM(CASE WHEN payment_method = 'transfer' THEN total ELSE 0 END), 0) as transfer_total
         FROM sales 
         WHERE branch_id = $1 AND DATE(created_at) = $2 AND status = 'completed'`,
        [branchId, date]
      );
      
      const stats = salesResult.rows[0];
      
      // Upsert report
      const result = await db.query(
        `INSERT INTO daily_reports (date, branch_id, branch_name, total_sales, total_transactions, 
         cash_total, card_total, transfer_total, tax_collected, closing_balance, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'open')
         ON CONFLICT (date, branch_id) 
         DO UPDATE SET total_sales = $4, total_transactions = $5, cash_total = $6, 
                       card_total = $7, transfer_total = $8, tax_collected = $9, closing_balance = $10
         RETURNING *`,
        [date, branchId, branch?.name, stats.total_sales, stats.transaction_count,
         stats.cash_total, stats.card_total, stats.transfer_total, stats.tax_collected, stats.cash_total]
      );
      
      await broadcastTable('daily_reports');
      res.json(result.rows[0]);
    } catch (error) {
      console.error('[DAILY REPORTS ERROR]', error);
      res.status(500).json({ error: 'Failed to generate report' });
    }
  });

  // Close day
  router.post('/:id/close', async (req, res) => {
    try {
      const { id } = req.params;
      const { closingBalance, notes, closedBy } = req.body;
      
      const result = await db.query(
        `UPDATE daily_reports 
         SET status = 'closed', closing_balance = $1, notes = $2, closed_by = $3, closed_at = CURRENT_TIMESTAMP
         WHERE id = $4 RETURNING *`,
        [closingBalance, notes, closedBy, id]
      );
      
      await broadcastTable('daily_reports');
      res.json(result.rows[0]);
    } catch (error) {
      console.error('[DAILY REPORTS ERROR]', error);
      res.status(500).json({ error: 'Failed to close day' });
    }
  });

  return router;
};
